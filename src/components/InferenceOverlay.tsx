import type { InferenceResult, SegmentationResult } from '@/types/model';
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

      // 세그멘테이션 마스크 그리기
      if (modelType === 'segmentation' && 'mask' in result) {
        const segResult = result as SegmentationResult;
        if (segResult.mask) {
          // 마스크를 캔버스에 그리기
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = videoElement.videoWidth;
          tempCanvas.height = videoElement.videoHeight;

          tempCtx.putImageData(segResult.mask, 0, 0);

          // 반투명 색상 마스크 적용
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = `hsl(${(segResult.classId * 137) % 360}, 70%, 50%)`;
          ctx.globalCompositeOperation = 'source-over';

          // 스케일링하여 그리기
          ctx.drawImage(
            tempCanvas,
            0,
            0,
            videoElement.videoWidth,
            videoElement.videoHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );

          ctx.restore();
        }
      }

      // 바운딩 박스 그리기
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

      ctx.fillStyle = getColorForType(modelType, result.classId);
      ctx.fillRect(
        scaledX1,
        scaledY1 - textHeight - 4,
        textMetrics.width + 8,
        textHeight + 4
      );

      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 4, scaledY1 - 6);
    });
  }, [results, videoElement, modelType]);

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
