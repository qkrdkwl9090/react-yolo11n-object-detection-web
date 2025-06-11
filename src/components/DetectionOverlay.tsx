import type { Detection } from '@/types/model';
import { useEffect, useRef } from 'react';

interface DetectionOverlayProps {
  detections: Detection[];
  videoElement: HTMLVideoElement | null;
  className?: string;
}

const DetectionOverlay = ({
  detections,
  videoElement,
  className,
}: DetectionOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기를 비디오 크기에 맞춤
    const rect = videoElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 스케일 팩터 계산
    const scaleX = rect.width / videoElement.videoWidth;
    const scaleY = rect.height / videoElement.videoHeight;

    // 감지 결과 그리기
    detections.forEach(detection => {
      const [x1, y1, x2, y2] = detection.bbox;

      // 좌표 스케일링
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;

      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;

      // 바운딩 박스 그리기
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      // 라벨 배경
      const text = `${detection.className} ${(detection.confidence * 100).toFixed(1)}%`;
      ctx.font = '14px Inter, sans-serif';
      const textMetrics = ctx.measureText(text);
      const textHeight = 16;

      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(
        scaledX1,
        scaledY1 - textHeight - 4,
        textMetrics.width + 8,
        textHeight + 4
      );

      // 라벨 텍스트
      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 4, scaledY1 - 6);
    });
  }, [detections, videoElement]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ zIndex: 10 }}
    />
  );
};

DetectionOverlay.displayName = 'DetectionOverlay';
export default DetectionOverlay;
