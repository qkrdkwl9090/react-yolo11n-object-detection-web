import { POSE_COLORS, POSE_SKELETON_CONNECTIONS } from '@/config/models';
import type {
  InferenceResult,
  PoseResult,
  SegmentationResult,
} from '@/types/model';
import { useCallback, useEffect, useRef } from 'react';

interface InferenceOverlayProps {
  results: InferenceResult[];
  videoElement: HTMLVideoElement | null;
  modelType: 'detection' | 'segmentation' | 'pose';
  className?: string;
}

const InferenceOverlay = ({
  results,
  videoElement,
  modelType,
  className,
}: InferenceOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevResultsRef = useRef<InferenceResult[]>([]);
  const prevCanvasSizeRef = useRef({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 색상 계산
  const getColorForType = useCallback(
    (type: string, classId?: number): string => {
      if (type === 'segmentation' && classId !== undefined) {
        const hue = (classId * 137) % 360;
        return `hsl(${hue}, 70%, 50%)`;
      }

      switch (type) {
        case 'detection':
          return '#3b82f6';
        case 'segmentation':
          return '#10b981';
        case 'pose':
          return '#8b5cf6';
        default:
          return '#3b82f6';
      }
    },
    []
  );

  // 세그멘테이션 마스크 그리기
  const drawSegmentationMask = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      result: SegmentationResult,
      videoElement: HTMLVideoElement
    ) => {
      if (!result.mask) return;

      // 임시 Canvas 재사용
      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
      }
      const tempCanvas = tempCanvasRef.current;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCanvas.width = videoElement.videoWidth;
      tempCanvas.height = videoElement.videoHeight;

      tempCtx.putImageData(result.mask, 0, 0);

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = `hsl(${(result.classId * 137) % 360}, 70%, 50%)`;
      ctx.globalCompositeOperation = 'source-over';

      ctx.drawImage(
        tempCanvas,
        0,
        0,
        videoElement.videoWidth,
        videoElement.videoHeight,
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height
      );

      ctx.restore();
    },
    []
  );

  // 포즈 키포인트 및 스켈레톤 그리기
  const drawPoseKeypoints = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      result: PoseResult,
      scaleX: number,
      scaleY: number
    ) => {
      const { keypoints } = result;

      // 스켈레톤 연결선 먼저 그리기
      ctx.lineWidth = 3;
      POSE_SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const startPoint = keypoints[startIdx - 1]; // 1-based to 0-based
        const endPoint = keypoints[endIdx - 1];

        if (!startPoint?.visible || !endPoint?.visible) return;
        if (startPoint.confidence < 0.5 || endPoint.confidence < 0.5) return;

        const startX = startPoint.x * scaleX;
        const startY = startPoint.y * scaleY;
        const endX = endPoint.x * scaleX;
        const endY = endPoint.y * scaleY;

        // 화면 영역 체크
        if (
          startX < 0 ||
          startY < 0 ||
          endX < 0 ||
          endY < 0 ||
          startX > ctx.canvas.width ||
          startY > ctx.canvas.height ||
          endX > ctx.canvas.width ||
          endY > ctx.canvas.height
        ) {
          return;
        }

        // 연결선 색상
        const avgIdx = Math.floor((startIdx + endIdx) / 2);
        ctx.strokeStyle = POSE_COLORS[avgIdx % POSE_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });

      // 키포인트 그리기
      keypoints.forEach((keypoint, idx) => {
        if (!keypoint.visible || keypoint.confidence < 0.5) return;

        const x = keypoint.x * scaleX;
        const y = keypoint.y * scaleY;

        // 화면 영역 체크
        if (x < 0 || y < 0 || x > ctx.canvas.width || y > ctx.canvas.height) {
          return;
        }

        // 키포인트 원
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = POSE_COLORS[idx % POSE_COLORS.length];
        ctx.fill();

        // 테두리
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 신뢰도가 높은 키포인트에 인덱스 표시 (선택사항)
        if (keypoint.confidence > 0.8) {
          ctx.fillStyle = 'white';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(idx.toString(), x, y + 3);
          ctx.textAlign = 'start'; // 기본값으로 복원
        }
      });
    },
    []
  );

  // Canvas 크기 업데이트 함수 메모이제이션
  const updateCanvasSize = useCallback(() => {
    if (!canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    const rect = videoElement.getBoundingClientRect();
    const newWidth = rect.width;
    const newHeight = rect.height;
    
    // 크기가 실제로 변경되었을 때만 업데이트
    if (
      canvas.width !== newWidth || 
      canvas.height !== newHeight ||
      prevCanvasSizeRef.current.width !== newWidth ||
      prevCanvasSizeRef.current.height !== newHeight
    ) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      prevCanvasSizeRef.current = { width: newWidth, height: newHeight };
      
      // 크기 변경 시 전체 클리어
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [videoElement]);

  // ResizeObserver 설정
  useEffect(() => {
    if (!videoElement) return;

    // 초기 크기 설정
    updateCanvasSize();

    // ResizeObserver 생성
    resizeObserverRef.current = new ResizeObserver(() => {
      updateCanvasSize();
    });

    // 비디오 요소 관찰 시작
    resizeObserverRef.current.observe(videoElement);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [videoElement, updateCanvasSize]);

  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 현재 Canvas 크기 사용 (ResizeObserver가 관리함)
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    if (canvasWidth === 0 || canvasHeight === 0) return;

    // 이전 결과 영역들을 클리어 (크기 변경이 아닌 경우)
    const prevResults = prevResultsRef.current;
    if (prevResults.length > 0) {
      prevResults.forEach(result => {
        const [x1, y1, x2, y2] = result.bbox;
        const scaleX = canvasWidth / videoElement.videoWidth;
        const scaleY = canvasHeight / videoElement.videoHeight;
        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        
        // 여백을 포함하여 클리어 (라벨 영역 포함)
        ctx.clearRect(
          Math.max(0, scaledX1 - 50), 
          Math.max(0, scaledY1 - 30), 
          Math.min(canvasWidth, scaledX2 - scaledX1 + 100),
          Math.min(canvasHeight, scaledY2 - scaledY1 + 60)
        );
      });
    }

    const scaleX = canvasWidth / videoElement.videoWidth;
    const scaleY = canvasHeight / videoElement.videoHeight;

    results.forEach(result => {
      const [x1, y1, x2, y2] = result.bbox;

      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;

      // 모델 타입별 렌더링
      if (modelType === 'segmentation' && 'mask' in result) {
        drawSegmentationMask(ctx, result as SegmentationResult, videoElement);
      } else if (modelType === 'pose' && 'keypoints' in result) {
        drawPoseKeypoints(ctx, result as PoseResult, scaleX, scaleY);
      }

      // 바운딩 박스 그리기 (공통)
      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;

      ctx.strokeStyle = getColorForType(modelType, result.classId);
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      // 라벨
      const text = `${result.className} ${(result.confidence * 100).toFixed(1)}%`;
      ctx.font = '14px Inter, sans-serif';
      const textMetrics = ctx.measureText(text);
      const textHeight = 16;

      // 라벨 위치 조정
      let labelX = scaledX1;
      let labelY = scaledY1 - textHeight - 4;

      // 라벨이 화면 밖으로 나가는 경우 조정
      if (labelY < 0) {
        labelY = scaledY1 + textHeight + 4; // 박스 아래로 이동
      }
      if (labelX + textMetrics.width + 8 > canvas.width) {
        labelX = canvas.width - textMetrics.width - 8; // 오른쪽 끝에 맞춤
      }
      if (labelX < 0) {
        labelX = 4; // 왼쪽 여백
      }

      ctx.fillStyle = getColorForType(modelType, result.classId);
      ctx.fillRect(labelX, labelY, textMetrics.width + 8, textHeight + 4);

      ctx.fillStyle = 'white';
      ctx.fillText(text, labelX + 4, labelY + textHeight - 2);
    });

    // 현재 결과를 다음 프레임을 위해 저장
    prevResultsRef.current = [...results];
  }, [
    results,
    videoElement,
    modelType,
    drawSegmentationMask,
    drawPoseKeypoints,
    getColorForType,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ zIndex: 10 }}
    />
  );
};

export default InferenceOverlay;
