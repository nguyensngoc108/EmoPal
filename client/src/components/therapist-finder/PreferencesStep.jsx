import React from 'react';

const PreferencesStep = ({ 
  preferences, 
  onChange, 
  onNext, 
  onBack 
}) => {
  const genderOptions = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
    { id: 'no_preference', label: 'No preference' }
  ];
  
  const approachOptions = [
    { id: 'cognitive_behavioral', label: 'Cognitive Behavioral (CBT)' },
    { id: 'psychodynamic', label: 'Psychodynamic' },
    { id: 'humanistic', label: 'Humanistic' },
    { id: 'integrative', label: 'Integrative' },
    { id: 'no_preference', label: 'No preference' }
  ];
  
  const languageOptions = [
    { id: 'english', label: 'English' },
    { id: 'spanish', label: 'Spanish' },
    { id: 'french', label: 'French' },
    { id: 'mandarin', label: 'Mandarin' },
    { id: 'german', label: 'German' },
    { id: 'arabic', label: 'Arabic' }
  ];
  
  const handleLanguageChange = (language) => {
    const newLanguages = [...(preferences.preferredLanguages || [])];
    
    if (newLanguages.includes(language)) {
      // Remove if already selected
      onChange('preferredLanguages', newLanguages.filter(l => l !== language));
    } else {
      // Add if not selected
      onChange('preferredLanguages', [...newLanguages, language]);
    }
  };

  return (
    <div className="wizard-step">
      <h2 className="text-2xl font-bold mb-6">Therapist Preferences</h2>
      <p className="text-gray-600 mb-8">Help us find your ideal match</p>
      
      {/* Gender preference */}
      <div className="mb-8">
        <h3 className="font-medium text-lg mb-3">Preferred therapist gender</h3>
        <div className="flex flex-wrap gap-3">
          {genderOptions.map((option) => (
            <button
              key={option.id}
              className={`px-4 py-2 rounded-full border ${
                preferences.preferredGender === option.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:border-indigo-400'
              }`}
              onClick={() => onChange('preferredGender', option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Therapeutic approach */}
      <div className="mb-8">
        <h3 className="font-medium text-lg mb-3">Preferred therapeutic approach</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {approachOptions.map((option) => (
            <button
              key={option.id}
              className={`px-4 py-2 rounded-md border text-left ${
                preferences.preferredApproach === option.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:border-indigo-400'
              }`}
              onClick={() => onChange('preferredApproach', option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Language preference */}
      <div className="mb-8">
        <h3 className="font-medium text-lg mb-3">Preferred languages (select all that apply)</h3>
        <div className="flex flex-wrap gap-3">
          {languageOptions.map((option) => (
            <button
              key={option.id}
              className={`px-4 py-2 rounded-full border ${
                preferences.preferredLanguages?.includes(option.id)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:border-indigo-400'
              }`}
              onClick={() => handleLanguageChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Price range */}
      <div className="mb-8">
        <h3 className="font-medium text-lg mb-3">Price range (per session)</h3>
        <div className="px-2">
          <input 
            type="range" 
            min="50" 
            max="300" 
            step="10"
            className="w-full accent-indigo-600"
            value={preferences.priceRange?.[1] || 200}
            onChange={(e) => onChange('priceRange', [50, parseInt(e.target.value)])}
          />
          <div className="flex justify-between text-gray-600 text-sm mt-2">
            <span>$50</span>
            <span>${preferences.priceRange?.[1] || 200}</span>
          </div>
        </div>
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
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default PreferencesStep;