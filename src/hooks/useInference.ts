import { COCO_CLASSES } from '@/config/models';
import type { Detection, ModelInfo } from '@/types/model';
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

      // 캔버스 생성 또는 재사용
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
      })!;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // 비디오를 캔버스에 그리기 (리사이즈)
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const { data } = imageData;

      // RGB 정규화 및 CHW 형식으로 변환
      const float32Data = new Float32Array(3 * targetWidth * targetHeight);
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        float32Data[pixelIndex] = data[i] / 255.0; // R
        float32Data[pixelIndex + targetWidth * targetHeight] =
          data[i + 1] / 255.0; // G
        float32Data[pixelIndex + targetWidth * targetHeight * 2] =
          data[i + 2] / 255.0; // B
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
      const [batchSize, numFeatures, numDetections] = output.dims;

      console.log('YOLO Output dims:', output.dims);
      console.log(
        `Processing: batch=${batchSize}, features=${numFeatures}, detections=${numDetections}`
      );

      const detections: Detection[] = [];

      // YOLO11 출력: [1, 84, 8400] 형태
      // 각 detection마다 84개 특성: [x, y, w, h, class1_conf, class2_conf, ..., class80_conf]

      for (let i = 0; i < numDetections; i++) {
        // 각 detection의 데이터 추출
        const x_center = data[0 * numDetections + i]; // x 좌표
        const y_center = data[1 * numDetections + i]; // y 좌표
        const width = data[2 * numDetections + i]; // width
        const height = data[3 * numDetections + i]; // height

        // 클래스 점수들 (4번째부터 83번째까지)
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
        if (
          x_center < 0 ||
          y_center < 0 ||
          x_center > modelWidth ||
          y_center > modelHeight
        )
          continue;

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

        // 최대 크기 확인 (너무 큰 박스 제거)
        // const maxBoxSize = Math.min(originalWidth, originalHeight) * 0.8;
        // if (boxWidth > maxBoxSize || boxHeight > maxBoxSize) continue;

        detections.push({
          bbox: [scaledX1, scaledY1, scaledX2, scaledY2],
          confidence: maxClassScore,
          classId,
          className: COCO_CLASSES[classId] || 'unknown',
        });
      }

      console.log(`Raw detections: ${detections.length}`);
      console.log(
        'Sample detections:',
        detections
          .slice(0, 5)
          .map(d => `${d.className}: ${d.confidence.toFixed(3)}`)
      );

      // NMS 적용
      const filteredDetections = applyNMS(detections, iouThreshold);
      console.log(`After NMS: ${filteredDetections.length}`);

      return filteredDetections;
    },
    []
  );

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

  const runInference = useCallback(
    async (
      session: ort.InferenceSession,
      video: HTMLVideoElement,
      model: ModelInfo
    ): Promise<Detection[]> => {
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
        const outputTensor = outputs[session.outputNames[0]];
        const detections = postprocessDetections(outputTensor, [
          video.videoWidth,
          video.videoHeight,
        ]);

        // 텐서 메모리 정리
        tensor.dispose();

        return detections;
      } catch (error) {
        console.error('Inference error:', error);
        return [];
      }
    },
    [preprocessImage, postprocessDetections]
  );

  return {
    runInference,
  };
};

export default useInference;
