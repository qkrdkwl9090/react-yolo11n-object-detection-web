import CameraSelector from '@/components/CameraSelector';
import InferenceOverlay from '@/components/InferenceOverlay';
import ModelSelector from '@/components/ModelSelector';
import useCamera from '@/hooks/useCamera';
import useInference from '@/hooks/useInference';
import useModel from '@/hooks/useModel';
import { cn } from '@/lib/utils';
import type { InferenceResult, ModelInfo } from '@/types/model';
import { useEffect, useRef, useState } from 'react';

const YoloContainer = () => {
  const [results, setResults] = useState<InferenceResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>(0);

  const camera = useCamera();
  const model = useModel();
  const { runInference } = useInference();

  // 실시간 추론 루프
  useEffect(() => {
    if (!isRunning || !model.session || !camera.stream || !videoRef.current) {
      return;
    }

    const runDetection = async () => {
      if (videoRef.current && model.session && model.selectedModel) {
        try {
          const newResults = await runInference(
            model.session,
            videoRef.current,
            model.selectedModel
          );
          setResults(newResults);
        } catch (error) {
          console.error('Detection error:', error);
        }
      }

      if (isRunning) {
        animationRef.current = requestAnimationFrame(runDetection);
      }
    };

    animationRef.current = requestAnimationFrame(runDetection);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    isRunning,
    model.session,
    camera.stream,
    runInference,
    model.selectedModel,
  ]);

  // 비디오 요소 업데이트
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  const handleModelSelect = async (modelInfo: ModelInfo) => {
    setIsRunning(false);
    setResults([]);
    await model.loadModel(modelInfo);
  };

  const toggleDetection = () => {
    if (model.isLoaded && camera.stream) {
      setIsRunning(!isRunning);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 카메라 설정 */}
      <CameraSelector
        devices={camera.devices}
        selectedDeviceId={camera.selectedDeviceId}
        stream={camera.stream}
        isLoading={camera.isLoading}
        error={camera.error}
        onDeviceSelect={camera.startCamera}
        onRefresh={camera.refreshDevices}
      />

      {/* 모델 선택 */}
      <ModelSelector
        selectedModel={model.selectedModel}
        isLoading={model.isLoading}
        onModelSelect={handleModelSelect}
      />

      {/* 비디오 스트림 및 감지 결과 */}
      <div className='p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>
            Real-time {model.selectedModel?.type || 'Detection'}
          </h2>
          <button
            onClick={toggleDetection}
            disabled={!model.isLoaded || !camera.stream}
            className={cn(
              'rounded px-2 py-1 text-sm',
              !model.isLoaded || !camera.stream
                ? 'cursor-not-allowed opacity-50'
                : isRunning
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {isRunning ? 'Stop Detection' : 'Start Detection'}
          </button>
        </div>

        <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-800'>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className='h-full w-full object-cover'
          />

          {/* 통합 오버레이 */}
          <InferenceOverlay
            results={results}
            videoElement={videoRef.current}
            modelType={model.selectedModel?.type || 'detection'}
          />

          {/* 상태 표시 */}
          <div className='absolute left-4 top-4 space-y-2'>
            <div
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                model.isLoaded
                  ? 'border border-green-500/30 bg-green-500/20 text-green-300'
                  : 'border border-gray-500/30 bg-gray-500/20 text-gray-400'
              )}
            >
              Model: {model.selectedModel?.name || 'None'}
            </div>

            {isRunning && (
              <div className='rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-300'>
                ● Live {model.selectedModel?.type} ({results.length} objects)
              </div>
            )}
          </div>
        </div>

        {/* 결과 통계 */}
        {results.length > 0 && (
          <div className='mt-4 rounded-lg bg-gray-800 p-4'>
            <h3 className='mb-2 text-sm font-medium text-gray-300'>
              Detected Objects ({model.selectedModel?.type}):
            </h3>
            <div className='flex flex-wrap gap-2'>
              {Array.from(new Set(results.map(r => r.className))).map(
                className => {
                  const count = results.filter(
                    r => r.className === className
                  ).length;
                  return (
                    <span
                      key={className}
                      className='text-primary-300 rounded bg-primary-500/20 px-2 py-1 text-sm'
                    >
                      {className}: {count}
                    </span>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

YoloContainer.displayName = 'YoloContainer';
export default YoloContainer;
