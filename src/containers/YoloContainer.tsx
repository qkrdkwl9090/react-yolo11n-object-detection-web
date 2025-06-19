import CameraSelector from '@/components/CameraSelector';
import InferenceOverlay from '@/components/InferenceOverlay';
import ModelSelector from '@/components/ModelSelector';
import useCamera from '@/hooks/useCamera';
import useInference from '@/hooks/useInference';
import useModel from '@/hooks/useModel';
import { cn } from '@/lib/utils';
import type { InferenceResult, ModelInfo } from '@/types/model';
import { useCallback, useEffect, useRef, useState } from 'react';

const YoloContainer = () => {
  const [results, setResults] = useState<InferenceResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const isRunningRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false); // 추론 중복 방지

  const camera = useCamera();
  const model = useModel();
  const { runInference } = useInference();

  // 추론 정리
  const cleanupInference = useCallback(() => {
    console.log('Cleaning up inference...');
    isRunningRef.current = false;
    isProcessingRef.current = false;
    setIsRunning(false);
    setResults([]);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  }, []);

  // 추론 시작
  const startInference = useCallback(() => {
    if (
      !model.session ||
      !camera.stream ||
      !videoRef.current ||
      !model.selectedModel
    ) {
      console.log('Cannot start inference: missing requirements');
      return;
    }

    console.log('Starting inference with model:', model.selectedModel.name);
    isRunningRef.current = true;
    isProcessingRef.current = false;
    setIsRunning(true);
  }, [model.session, camera.stream, model.selectedModel]);

  // 실시간 추론 루프
  useEffect(() => {
    if (
      !isRunningRef.current ||
      !model.session ||
      !camera.stream ||
      !videoRef.current ||
      !model.selectedModel
    ) {
      return;
    }

    const runDetection = async () => {
      // 실행 상태 재확인
      if (!isRunningRef.current) {
        console.log('Inference stopped, exiting loop');
        return;
      }

      // 이전 추론이 아직 진행 중이면 스킵 (프레임 드롭)
      if (isProcessingRef.current) {
        if (isRunningRef.current) {
          animationRef.current = requestAnimationFrame(runDetection);
        }
        return;
      }

      if (
        videoRef.current &&
        model.session &&
        model.selectedModel &&
        isRunningRef.current
      ) {
        isProcessingRef.current = true;

        try {
          const newResults = await runInference(
            model.session,
            videoRef.current,
            model.selectedModel
          );

          // 결과 설정 전에 다시 한 번 실행 상태 확인
          if (isRunningRef.current) {
            setResults(newResults);
          }
        } catch (error) {
          console.error('Detection error:', error);
        } finally {
          isProcessingRef.current = false;
        }
      }

      // 다음 프레임 스케줄링
      if (isRunningRef.current) {
        animationRef.current = requestAnimationFrame(runDetection);
      }
    };

    // 이전 애니메이션 프레임 정리
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(runDetection);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [
    model.session,
    camera.stream,
    runInference,
    model.selectedModel,
    isRunning, // isRunning 변경 시에도 effect 재실행
  ]);

  // 비디오 요소 업데이트
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // 모델 선택 핸들러 - 완전한 상태 리셋
  const handleModelSelect = async (modelInfo: ModelInfo) => {
    console.log('Model selection started:', modelInfo.name);

    // 1. 즉시 추론 정리
    cleanupInference();

    // 2. 약간의 지연 후 모델 로드 (이전 추론이 완전히 정리될 시간)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. 모델 로드
    try {
      await model.loadModel(modelInfo);
      console.log('Model loaded successfully:', modelInfo.name);
    } catch (error) {
      console.error('Model loading failed:', error);
    }
  };

  // 추론 토글 핸들러
  const toggleDetection = () => {
    if (!model.isLoaded || !camera.stream) {
      console.log('Cannot toggle: model not loaded or camera not available');
      return;
    }

    if (isRunningRef.current) {
      console.log('Stopping detection');
      cleanupInference();
    } else {
      console.log('Starting detection');
      startInference();
    }
  };

  // 모델이 변경될 때 추론 정리
  useEffect(() => {
    if (model.selectedModel) {
      console.log('Model changed, cleaning up previous inference');
      cleanupInference();
    }
  }, [model.selectedModel, cleanupInference]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up');
      cleanupInference();
    };
  }, [cleanupInference]);

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

            {/* 처리 상태 표시 (개발 환경에서만) */}
            {import.meta.env.DEV && (
              <div className='rounded bg-gray-900/80 px-2 py-1 text-xs text-gray-400'>
                Running: {isRunning ? 'Yes' : 'No'} | Processing:{' '}
                {isProcessingRef.current ? 'Yes' : 'No'} | Session:{' '}
                {model.session ? 'Ready' : 'None'}
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
