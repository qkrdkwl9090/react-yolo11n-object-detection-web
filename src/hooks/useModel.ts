import type { ModelInfo, ModelState } from '@/types/model';
import * as ort from 'onnxruntime-web';
import { useCallback, useRef, useState } from 'react';

// ONNX Runtime Web 설정
ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

const useModel = () => {
  const [state, setState] = useState<ModelState>({
    selectedModel: null,
    isLoading: false,
    isLoaded: false,
    error: null,
    session: null,
  });

  const sessionRef = useRef<ort.InferenceSession | null>(null);

  const loadModel = useCallback(async (model: ModelInfo) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        selectedModel: model,
      }));

      console.log(`Loading model: ${model.name}`);

      // 기존 세션 정리
      if (sessionRef.current) {
        sessionRef.current.release();
        sessionRef.current = null;
      }

      // 새 세션 생성
      const session = await ort.InferenceSession.create(model.file, {
        executionProviders: ['webgpu', 'webgl', 'cpu'], // WebGPU 우선, WebGL, CPU 폴백
        graphOptimizationLevel: 'all',
      });

      sessionRef.current = session;

      console.log(`Model loaded successfully: ${model.name}`);
      console.log('Input names:', session.inputNames);
      console.log('Output names:', session.outputNames);

      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoaded: true,
        session,
      }));
    } catch (error) {
      console.error('Model loading error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoaded: false,
        error: error instanceof Error ? error.message : 'Failed to load model',
      }));
    }
  }, []);

  const unloadModel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.release();
      sessionRef.current = null;
    }
    setState({
      selectedModel: null,
      isLoading: false,
      isLoaded: false,
      error: null,
      session: null,
    });
  }, []);

  return {
    ...state,
    loadModel,
    unloadModel,
  };
};

export default useModel;
