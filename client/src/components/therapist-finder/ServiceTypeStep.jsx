import React from 'react';

const serviceTypes = [
  { id: 'therapy', label: 'Individual Therapy', description: 'One-on-one sessions with a therapist' },
  { id: 'teen_therapy', label: 'Teen Therapy', description: 'Specialized support for adolescents' },
  { id: 'couples_therapy', label: 'Couples Therapy', description: 'Support for relationship challenges' },
  { id: 'psychiatry', label: 'Psychiatry', description: 'Medication management and treatment' },
  { id: 'family_therapy', label: 'Family Therapy', description: 'Support for family dynamics and conflicts' }
];

const ServiceTypeStep = ({ value, onChange, onNext }) => {
  return (
    <div className="wizard-step">
      <h2 className="text-2xl font-bold mb-6">What type of service are you looking for?</h2>
      <p className="text-gray-600 mb-8">Select the type of therapy that best fits your needs</p>
      
      <div className="space-y-4">
        {serviceTypes.map((type) => (
          <div 
            key={type.id}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              value === type.id 
                ? 'border-indigo-600 bg-indigo-50' 
                : 'border-gray-300 hover:border-indigo-300'
            }`}
            onClick={() => onChange('serviceType', type.id)}
          >
            <div className="flex items-center">
              <div className={`w-5 h-5 rounded-full border ${
                value === type.id 
                  ? 'border-indigo-600 bg-indigo-600' 
                  : 'border-gray-400'
              } mr-3`}>
                {value === type.id && (
                  <div className="w-3 h-3 bg-white rounded-full m-auto mt-1" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{type.label}</h3>
                <p className="text-sm text-gray-500">{type.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-10 flex justify-end">
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

export default ServiceTypeStep;