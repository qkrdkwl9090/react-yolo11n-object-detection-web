import { POSE_COLORS, POSE_SKELETON_CONNECTIONS } from '@/config/models';
import type {
  InferenceResult,
  PoseResult,
  SegmentationResult,
} from '@/types/model';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = videoElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = rect.width / videoElement.videoWidth;
    const scaleY = rect.height / videoElement.videoHeight;

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
  }, [results, videoElement, modelType]);

  // 세그멘테이션 마스크 그리기
  const drawSegmentationMask = (
    ctx: CanvasRenderingContext2D,
    result: SegmentationResult,
    videoElement: HTMLVideoElement
  ) => {
    if (!result.mask) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
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
  };

  // 포즈 키포인트 및 스켈레톤 그리기
  const drawPoseKeypoints = (
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
  };

  const getColorForType = (type: string, classId?: number): string => {
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
  };

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ zIndex: 10 }}
    />
  );
};

export default InferenceOverlay;
