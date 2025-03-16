import React from 'react';

const helpReasons = [
  { id: 'anxiety', label: 'Anxiety & Stress', description: 'Feeling anxious or overwhelmed' },
  { id: 'depression', label: 'Depression', description: 'Persistent sadness or low mood' },
  { id: 'relationships', label: 'Relationship Issues', description: 'Challenges with partners, family, or friends' },
  { id: 'trauma', label: 'Trauma & PTSD', description: 'Past traumatic experiences' },
  { id: 'sleep', label: 'Sleep Problems', description: 'Difficulty sleeping or insomnia' },
  { id: 'self_esteem', label: 'Self-Esteem', description: 'Negative feelings about yourself' },
  { id: 'grief', label: 'Grief & Loss', description: 'Coping with significant loss' },
  { id: 'other', label: 'Other Concerns', description: 'Issues not listed above' }
];

const HelpReasonStep = ({ value, onChange, onNext, onBack }) => {
  return (
    <div className="wizard-step">
      <h2 className="text-2xl font-bold mb-6">Why are you looking for help today?</h2>
      <p className="text-gray-600 mb-8">Select the primary issue you'd like to address</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {helpReasons.map((reason) => (
          <div 
            key={reason.id}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              value === reason.id 
                ? 'border-indigo-600 bg-indigo-50' 
                : 'border-gray-300 hover:border-indigo-300'
            }`}
            onClick={() => onChange('helpReason', reason.id)}
          >
            <div className="flex items-center">
              <div className={`w-5 h-5 rounded-full border ${
                value === reason.id 
                  ? 'border-indigo-600 bg-indigo-600' 
                  : 'border-gray-400'
              } mr-3`}>
                {value === reason.id && (
                  <div className="w-3 h-3 bg-white rounded-full m-auto mt-1" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{reason.label}</h3>
                <p className="text-sm text-gray-500">{reason.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-10 flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!value}
          className={`px-6 py-2 rounded-md ${
            value 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default HelpReasonStep;