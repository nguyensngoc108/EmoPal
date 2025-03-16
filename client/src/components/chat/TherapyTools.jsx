import React from 'react';
import { 
  ChartBarIcon, ClipboardDocumentListIcon, 
  DocumentTextIcon, ArrowTrendingUpIcon 
} from '@heroicons/react/24/outline';

const TherapyTools = ({ sessionId, onToolSelect }) => {
  const tools = [
    {
      id: 'mood-tracker',
      name: 'Mood Tracker',
      icon: <ChartBarIcon className="w-5 h-5" />,
      description: 'Track your mood patterns over time'
    },
    {
      id: 'homework',
      name: 'Exercises',
      icon: <ClipboardDocumentListIcon className="w-5 h-5" />,
      description: 'View and complete assigned activities'
    },
    {
      id: 'resources',
      name: 'Resources',
      icon: <DocumentTextIcon className="w-5 h-5" />,
      description: 'Helpful articles and worksheets'
    },
    {
      id: 'progress',
      name: 'Progress',
      icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
      description: 'View your therapy journey progress'
    }
  ];
  
  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">Therapy Tools</h3>
      <div className="grid grid-cols-2 gap-2">
        {tools.map(tool => (
          <button 
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className="flex flex-col items-center p-3 border rounded hover:bg-gray-50">
            {tool.icon}
            <span className="mt-1 text-xs font-medium">{tool.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TherapyTools;