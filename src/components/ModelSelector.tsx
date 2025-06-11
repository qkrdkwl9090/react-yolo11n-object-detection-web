import { YOLO_MODELS } from '@/config/models';
import { cn } from '@/lib/utils';
import type { ModelInfo } from '@/types/model';

interface ModelSelectorProps {
  selectedModel: ModelInfo | null;
  isLoading: boolean;
  onModelSelect: (model: ModelInfo) => void;
}

const ModelSelector = ({
  selectedModel,
  isLoading,
  onModelSelect,
}: ModelSelectorProps) => {
  return (
    <div className='p-6'>
      <h2 className='mb-4 text-xl font-semibold'>Model Selection</h2>

      <div className='space-y-3'>
        <label className='block text-sm font-medium text-gray-300'>
          Choose YOLO Model ({YOLO_MODELS.length} available)
        </label>

        <div className='grid gap-3'>
          {YOLO_MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => onModelSelect(model)}
              disabled={isLoading}
              className={cn(
                'rounded-lg border p-4 text-left transition-all duration-200',
                selectedModel?.id === model.id
                  ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='font-medium'>{model.name}</h3>
                  <p className='mt-1 text-sm text-gray-400'>
                    {model.description}
                  </p>
                  <span
                    className={cn(
                      'mt-2 inline-block rounded px-2 py-1 text-xs',
                      model.type === 'detection' &&
                        'bg-blue-500/20 text-blue-300',
                      model.type === 'segmentation' &&
                        'bg-green-500/20 text-green-300',
                      model.type === 'pose' &&
                        'bg-purple-500/20 text-purple-300'
                    )}
                  >
                    {model.type}
                  </span>
                </div>
                {selectedModel?.id === model.id && (
                  <div className='text-primary-400'>✓</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className='flex items-center space-x-2 text-sm text-gray-400'>
            <div className='border-primary-500 h-4 w-4 animate-spin rounded-full border-b-2'></div>
            <span>Loading model...</span>
          </div>
        )}
      </div>
    </div>
  );
};

ModelSelector.displayName = 'ModelSelector';
export default ModelSelector;
