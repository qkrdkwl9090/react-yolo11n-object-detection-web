import { COCO_CLASSES } from '@/config/models';
import type {
  Detection,
  InferenceResult,
  ModelInfo,
  PoseResult,
  SegmentationResult,
} from '@/types/model';
import * as ort from 'onnxruntime-web';
import { useCallback, useRef } from 'react';

const useInference = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const preprocessImage = useCallback(
    (
      video: HTMLVideoElement,
      targetSize: [number, number] = [640, 640]
    ): { tensor: ort.Tensor; canvas: HTMLCanvasElement } => {
      const [targetWidth, targetHeight] = targetSize;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
      })!;

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const { data } = imageData;

      const float32Data = new Float32Array(3 * targetWidth * targetHeight);
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        float32Data[pixelIndex] = data[i] / 255.0;
        float32Data[pixelIndex + targetWidth * targetHeight] =
          data[i + 1] / 255.0;
        float32Data[pixelIndex + targetWidth * targetHeight * 2] =
          data[i + 2] / 255.0;
      }

      const tensor = new ort.Tensor('float32', float32Data, [
        1,
        3,
        targetHeight,
        targetWidth,
      ]);

      return { tensor, canvas };
    },
    []
  );

  // Detection 후처리 (기존)
  const postprocessDetections = useCallback(
    (
      output: ort.Tensor,
      originalSize: [number, number],
      modelSize: [number, number] = [640, 640],
      confidenceThreshold: number = 0.5,
      iouThreshold: number = 0.4
    ): Detection[] => {
      const [originalWidth, originalHeight] = originalSize;
      const [modelWidth, modelHeight] = modelSize;

      const data = output.data as Float32Array;
      const [, , numDetections] = output.dims;

      const detections: Detection[] = [];

      for (let i = 0; i < numDetections; i++) {
        const x_center = data[0 * numDetections + i];
        const y_center = data[1 * numDetections + i];
        const width = data[2 * numDetections + i];
        const height = data[3 * numDetections + i];

        let maxClassScore = 0;
        let classId = 0;

        for (let j = 0; j < 80; j++) {
          const classScore = data[(4 + j) * numDetections + i];
          if (classScore > maxClassScore) {
            maxClassScore = classScore;
            classId = j;
          }
        }

        // 신뢰도 임계값 확인
        if (maxClassScore < confidenceThreshold) continue;

        // 좌표 유효성 확인
        if (width <= 0 || height <= 0) continue;
        // center 좌표를 corner 좌표로 변환
        const x1 = x_center - width / 2;
        const y1 = y_center - height / 2;
        const x2 = x_center + width / 2;
        const y2 = y_center + height / 2;

        // 모델 좌표를 원본 이미지 좌표로 스케일링
        const scaledX1 = Math.max(0, (x1 / modelWidth) * originalWidth);
        const scaledY1 = Math.max(0, (y1 / modelHeight) * originalHeight);
        const scaledX2 = Math.min(
          originalWidth,
          (x2 / modelWidth) * originalWidth
        );
        const scaledY2 = Math.min(
          originalHeight,
          (y2 / modelHeight) * originalHeight
        );

        // 최소 크기 확인 (너무 작은 박스 제거)
        const boxWidth = scaledX2 - scaledX1;
        const boxHeight = scaledY2 - scaledY1;
        if (boxWidth < 20 || boxHeight < 20) continue;

        detections.push({
          bbox: [scaledX1, scaledY1, scaledX2, scaledY2],
          confidence: maxClassScore,
          classId,
          className: COCO_CLASSES[classId] || 'unknown',
        });
      }

      return applyNMS(detections, iouThreshold);
    },
    []
  );

  // Segmentation 후처리
  const postprocessSegmentation = useCallback(
    (
      outputs: { [name: string]: ort.Tensor },
      originalSize: [number, number],
      modelSize: [number, number] = [640, 640],
      confidenceThreshold: number = 0.5,
      iouThreshold: number = 0.4
    ): SegmentationResult[] => {
      const [originalWidth, originalHeight] = originalSize;
      const [modelWidth, modelHeight] = modelSize;

      // YOLO11-seg 출력: output0 [1, 116, 8400], output1 [1, 32, 160, 160]
      const output0 = outputs.output0; // detection + mask coefficients
      const output1 = outputs.output1; // proto masks

      console.log('Segmentation outputs:');
      console.log('Output0 (detection+coeffs):', output0.dims);
      console.log('Output1 (proto masks):', output1.dims);

      const data0 = output0.data as Float32Array;
      const data1 = output1.data as Float32Array;

      const [, , numDetections] = output0.dims;
      const [, protoChannels, protoHeight, protoWidth] = output1.dims;

      const results: SegmentationResult[] = [];

      for (let i = 0; i < numDetections; i++) {
        // 바운딩 박스 좌표
        const x_center = data0[0 * numDetections + i];
        const y_center = data0[1 * numDetections + i];
        const width = data0[2 * numDetections + i];
        const height = data0[3 * numDetections + i];

        // 클래스 점수
        let maxClassScore = 0;
        let classId = 0;

        for (let j = 0; j < 80; j++) {
          const classScore = data0[(4 + j) * numDetections + i];
          if (classScore > maxClassScore) {
            maxClassScore = classScore;
            classId = j;
          }
        }

        if (maxClassScore < confidenceThreshold) continue;
        if (width <= 0 || height <= 0) continue;

        // 마스크 계수 추출 (84~115번째)
        const maskCoeffs: number[] = [];
        for (let j = 84; j < 116; j++) {
          maskCoeffs.push(data0[j * numDetections + i]);
        }

        // 바운딩 박스 좌표 변환
        const x1 = x_center - width / 2;
        const y1 = y_center - height / 2;
        const x2 = x_center + width / 2;
        const y2 = y_center + height / 2;

        const scaledX1 = Math.max(0, (x1 / modelWidth) * originalWidth);
        const scaledY1 = Math.max(0, (y1 / modelHeight) * originalHeight);
        const scaledX2 = Math.min(
          originalWidth,
          (x2 / modelWidth) * originalWidth
        );
        const scaledY2 = Math.min(
          originalHeight,
          (y2 / modelHeight) * originalHeight
        );

        // 마스크 생성
        const mask = generateSegmentationMask(
          maskCoeffs,
          data1,
          [protoChannels, protoHeight, protoWidth],
          [scaledX1, scaledY1, scaledX2, scaledY2],
          [originalWidth, originalHeight]
        );

        results.push({
          bbox: [scaledX1, scaledY1, scaledX2, scaledY2],
          confidence: maxClassScore,
          classId,
          className: COCO_CLASSES[classId] || 'unknown',
          mask: mask,
        });
      }

      console.log(`Segmentation results: ${results.length}`);
      return applyNMSSegmentation(results, iouThreshold);
    },
    []
  );

  // Pose 후처리 (새로 추가)
  const postprocessPose = useCallback(
    (
      output: ort.Tensor,
      originalSize: [number, number],
      modelSize: [number, number] = [640, 640],
      confidenceThreshold: number = 0.5,
      iouThreshold: number = 0.4
    ): PoseResult[] => {
      const [originalWidth, originalHeight] = originalSize;
      const [modelWidth, modelHeight] = modelSize;

      const data = output.data as Float32Array;
      const [batchSize, numFeatures, numDetections] = output.dims;

      console.log('Pose Output dims:', output.dims);
      console.log(
        `Processing: batch=${batchSize}, features=${numFeatures}, detections=${numDetections}`
      );

      const results: PoseResult[] = [];

      // YOLO11-pose 출력: [1, 56, 8400] 형태
      // 56 = 4(bbox) + 1(person_conf) + 17*3(keypoints: x,y,conf)

      for (let i = 0; i < numDetections; i++) {
        const x_center = data[0 * numDetections + i];
        const y_center = data[1 * numDetections + i];
        const width = data[2 * numDetections + i];
        const height = data[3 * numDetections + i];
        const personConf = data[4 * numDetections + i];

        if (personConf < confidenceThreshold) continue;
        if (width <= 0 || height <= 0) continue;

        // 17개 키포인트 추출 (5번째부터)
        const keypoints = [];
        for (let j = 0; j < 17; j++) {
          const keypointX = data[(5 + j * 3) * numDetections + i];
          const keypointY = data[(5 + j * 3 + 1) * numDetections + i];
          const keypointConf = data[(5 + j * 3 + 2) * numDetections + i];

          // 모델 좌표를 원본 이미지 좌표로 변환
          const scaledX = (keypointX / modelWidth) * originalWidth;
          const scaledY = (keypointY / modelHeight) * originalHeight;

          keypoints.push({
            x: scaledX,
            y: scaledY,
            confidence: keypointConf,
            visible: keypointConf > 0.5,
          });
        }

        // 바운딩 박스 좌표 변환
        const x1 = x_center - width / 2;
        const y1 = y_center - height / 2;
        const x2 = x_center + width / 2;
        const y2 = y_center + height / 2;

        const scaledX1 = Math.max(0, (x1 / modelWidth) * originalWidth);
        const scaledY1 = Math.max(0, (y1 / modelHeight) * originalHeight);
        const scaledX2 = Math.min(
          originalWidth,
          (x2 / modelWidth) * originalWidth
        );
        const scaledY2 = Math.min(
          originalHeight,
          (y2 / modelHeight) * originalHeight
        );

        results.push({
          bbox: [scaledX1, scaledY1, scaledX2, scaledY2],
          confidence: personConf,
          classId: 0, // person
          className: 'person',
          keypoints,
        });
      }

      console.log(`Pose results: ${results.length}`);
      return applyNMSPose(results, iouThreshold);
    },
    []
  );

  // 마스크 생성 함수
  const generateSegmentationMask = useCallback(
    (
      coeffs: number[],
      protoData: Float32Array,
      protoDims: [number, number, number], // [channels, height, width]
      bbox: [number, number, number, number],
      originalSize: [number, number]
    ): ImageData => {
      const [protoChannels, protoHeight, protoWidth] = protoDims;
      const [originalWidth, originalHeight] = originalSize;
      const [x1, y1, x2, y2] = bbox;

      // coeffs와 proto를 곱해서 마스크 생성
      const maskData = new Float32Array(protoHeight * protoWidth);

      for (let y = 0; y < protoHeight; y++) {
        for (let x = 0; x < protoWidth; x++) {
          let sum = 0;
          for (let c = 0; c < Math.min(coeffs.length, protoChannels); c++) {
            const protoIdx = c * protoHeight * protoWidth + y * protoWidth + x;
            sum += coeffs[c] * protoData[protoIdx];
          }
          // Sigmoid 활성화 함수 적용
          maskData[y * protoWidth + x] = 1 / (1 + Math.exp(-sum));
        }
      }

      // 마스크를 원본 크기로 리사이즈
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      canvas.width = originalWidth;
      canvas.height = originalHeight;

      // 임시 캔버스에 proto 크기로 마스크 그리기
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCanvas.width = protoWidth;
      tempCanvas.height = protoHeight;

      const tempImageData = tempCtx.createImageData(protoWidth, protoHeight);
      const threshold = 0.5;

      // 마스크 데이터를 ImageData로 변환
      for (let i = 0; i < maskData.length; i++) {
        const alpha = maskData[i] > threshold ? 255 : 0;
        const pixelIndex = i * 4;
        tempImageData.data[pixelIndex] = 255; // R
        tempImageData.data[pixelIndex + 1] = 255; // G
        tempImageData.data[pixelIndex + 2] = 255; // B
        tempImageData.data[pixelIndex + 3] = alpha; // A
      }

      tempCtx.putImageData(tempImageData, 0, 0);

      // 원본 크기로 리사이즈하여 그리기
      ctx.drawImage(tempCanvas, 0, 0, originalWidth, originalHeight);

      // 바운딩 박스 영역만 마스킹
      const finalImageData = ctx.getImageData(
        0,
        0,
        originalWidth,
        originalHeight
      );
      const finalData = finalImageData.data;

      for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
          const pixelIndex = (y * originalWidth + x) * 4;

          // 바운딩 박스 밖의 픽셀은 투명
          if (x < x1 || x > x2 || y < y1 || y > y2) {
            finalData[pixelIndex + 3] = 0; // Alpha = 0
          }
        }
      }

      return finalImageData;
    },
    []
  );

  // Detection NMS
  const applyNMS = useCallback(
    (detections: Detection[], iouThreshold: number): Detection[] => {
      const sortedDetections = [...detections].sort(
        (a, b) => b.confidence - a.confidence
      );
      const keep: Detection[] = [];
      const suppressed = new Set<number>();

      for (let i = 0; i < sortedDetections.length; i++) {
        if (suppressed.has(i)) continue;

        keep.push(sortedDetections[i]);

        for (let j = i + 1; j < sortedDetections.length; j++) {
          if (suppressed.has(j)) continue;

          const iou = calculateIoU(
            sortedDetections[i].bbox,
            sortedDetections[j].bbox
          );
          if (
            iou > iouThreshold &&
            sortedDetections[i].classId === sortedDetections[j].classId
          ) {
            suppressed.add(j);
          }
        }
      }

      return keep;
    },
    []
  );

  // Segmentation NMS
  const applyNMSSegmentation = useCallback(
    (
      results: SegmentationResult[],
      iouThreshold: number
    ): SegmentationResult[] => {
      const sortedResults = [...results].sort(
        (a, b) => b.confidence - a.confidence
      );
      const keep: SegmentationResult[] = [];
      const suppressed = new Set<number>();

      for (let i = 0; i < sortedResults.length; i++) {
        if (suppressed.has(i)) continue;

        keep.push(sortedResults[i]);

        for (let j = i + 1; j < sortedResults.length; j++) {
          if (suppressed.has(j)) continue;

          const iou = calculateIoU(
            sortedResults[i].bbox,
            sortedResults[j].bbox
          );
          if (
            iou > iouThreshold &&
            sortedResults[i].classId === sortedResults[j].classId
          ) {
            suppressed.add(j);
          }
        }
      }

      return keep;
    },
    []
  );

  const applyNMSPose = useCallback(
    (results: PoseResult[], iouThreshold: number): PoseResult[] => {
      const sortedResults = [...results].sort(
        (a, b) => b.confidence - a.confidence
      );
      const keep: PoseResult[] = [];
      const suppressed = new Set<number>();

      for (let i = 0; i < sortedResults.length; i++) {
        if (suppressed.has(i)) continue;
        keep.push(sortedResults[i]);

        for (let j = i + 1; j < sortedResults.length; j++) {
          if (suppressed.has(j)) continue;
          const iou = calculateIoU(
            sortedResults[i].bbox,
            sortedResults[j].bbox
          );
          if (iou > iouThreshold) {
            suppressed.add(j);
          }
        }
      }

      return keep;
    },
    []
  );

  const calculateIoU = useCallback(
    (bbox1: number[], bbox2: number[]): number => {
      const [x1_1, y1_1, x2_1, y2_1] = bbox1;
      const [x1_2, y1_2, x2_2, y2_2] = bbox2;

      const intersectionX1 = Math.max(x1_1, x1_2);
      const intersectionY1 = Math.max(y1_1, y1_2);
      const intersectionX2 = Math.min(x2_1, x2_2);
      const intersectionY2 = Math.min(y2_1, y2_2);

      const intersectionArea =
        Math.max(0, intersectionX2 - intersectionX1) *
        Math.max(0, intersectionY2 - intersectionY1);

      const area1 = (x2_1 - x1_1) * (y2_1 - y1_1);
      const area2 = (x2_2 - x1_2) * (y2_2 - y1_2);
      const unionArea = area1 + area2 - intersectionArea;

      return intersectionArea / unionArea;
    },
    []
  );

  // 통합 추론 함수
  const runInference = useCallback(
    async (
      session: ort.InferenceSession,
      video: HTMLVideoElement,
      model: ModelInfo
    ): Promise<InferenceResult[]> => {
      try {
        // 전처리
        const { tensor } = preprocessImage(video, [
          model.inputShape[2],
          model.inputShape[3],
        ]);

        // 추론 실행
        const feeds = { [session.inputNames[0]]: tensor };
        const outputs = await session.run(feeds);

        // 후처리
        let results: InferenceResult[] = [];

        switch (model.type) {
          case 'segmentation':
            results = postprocessSegmentation(outputs, [
              video.videoWidth,
              video.videoHeight,
            ]);
            break;
          case 'pose':
            const outputTensor = outputs[session.outputNames[0]];
            results = postprocessPose(outputTensor, [
              video.videoWidth,
              video.videoHeight,
            ]);
            break;
          default: // detection
            const detectionTensor = outputs[session.outputNames[0]];
            results = postprocessDetections(detectionTensor, [
              video.videoWidth,
              video.videoHeight,
            ]);
            break;
        }

        // 텐서 메모리 정리
        tensor.dispose();
        return results;
      } catch (error) {
        console.error('Inference error:', error);
        return [];
      }
    },
    [
      preprocessImage,
      postprocessDetections,
      postprocessSegmentation,
      postprocessPose,
    ]
  );

  return { runInference };
};

export default useInference;
