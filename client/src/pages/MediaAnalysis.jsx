import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import EmotionService from '../services/EmotionServices';
import { 
  ArrowUpTrayIcon, 
  DocumentIcon, 
  VideoCameraIcon,
  PhotoIcon, 
  XMarkIcon,
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import '../styles/MediaAnalysis.css';

const MediaAnalysis = () => {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Maximum file sizes
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
  const MAX_VIDEO_DURATION = 10 * 60; // 10 minutes in seconds

  // Fetch previous analyses when component mounts
  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const response = await EmotionService.getUserAnalyses();
      console.log('Analysis response:', response.data); // Add this line
      setAnalyses(response.data.analyses || []);
    } catch (err) {
      setError('Failed to load your previous analyses');
      console.error('Error fetching analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setUploadError('');

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    const isImage = allowedImageTypes.includes(selectedFile.type);
    const isVideo = allowedVideoTypes.includes(selectedFile.type);

    if (!isImage && !isVideo) {
      setUploadError('Please select a valid image (JPEG, PNG, GIF) or video (MP4, MOV, WEBM) file');
      return;
    }

    // Validate file size
    if (isImage && selectedFile.size > MAX_IMAGE_SIZE) {
      setUploadError(`Image must be less than ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return;
    }

    if (isVideo && selectedFile.size > MAX_VIDEO_SIZE) {
      setUploadError(`Video must be less than ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`);
      return;
    }

    // Additional check for video duration
    if (isVideo) {
      try {
        const duration = await getVideoDuration(selectedFile);
        if (duration > MAX_VIDEO_DURATION) {
          setUploadError(`Video must be shorter than ${MAX_VIDEO_DURATION / 60} minutes`);
          return;
        }
      } catch (error) {
        console.error('Error checking video duration:', error);
        // Continue anyway if we can't check duration
      }
    }

    // Set file and create preview
    setFile(selectedFile);
    
    // Create file preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  // Helper function to get video duration
  const getVideoDuration = (videoFile) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        reject("Error loading video");
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
  
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');
  
    try {
      const formData = new FormData();
      formData.append('file', file);
  
      // Set initial phase
      setUploadPhase('uploading');
      
      // For videos, adjust the progress indication to account for longer processing
      const isVideo = file.type.startsWith('video/');
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          // For videos, slow down the progress to reflect longer processing time
          const increment = isVideo ? 
            (prev < 50 ? 5 : prev < 75 ? 2 : 1) : 
            (prev < 70 ? 10 : 5);
            
          const newProgress = prev + increment;
          
          // Update phase based on progress
          if (prev < 20 && newProgress >= 20) {
            setUploadPhase('preprocessing');
          } else if (prev < 50 && newProgress >= 50) {
            setUploadPhase(isVideo ? 'analyzing_frames' : 'analyzing');
          } else if (prev < 80 && newProgress >= 80) {
            setUploadPhase(isVideo ? 'generating_visualizations' : 'finalizing');
          }
          
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, isVideo ? 1000 : 500); // Slower updates for video
  
      // Upload the file
      const response = await EmotionService.uploadAndAnalyze(formData);
  
      // Clear the interval and set progress to 100%
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadPhase('complete');
  
      // Refresh the analyses list
      fetchAnalyses();
  
      // Clear the file input after a delay
      setTimeout(() => {
        setFile(null);
        setFilePreview('');
        setIsUploading(false);
        setUploadProgress(0);
        setUploadPhase('');
      }, 1500);
  
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadError(err.response?.data?.error || 'Failed to upload and analyze file');
      setIsUploading(false);
      setUploadProgress(0);
      setUploadPhase('');
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview('');
    setUploadError('');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Media Emotion Analysis</h1>
            <p className="text-gray-600 mt-2">
              Upload images or videos to analyze emotions
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Media</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {!file ? (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => document.getElementById('file-upload').click()}
              >
                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-600">
                  <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Images (PNG, JPG, GIF) up to 10MB or videos (MP4, MOV, WEBM) up to 100MB
                </p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime,video/webm"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    {file.type.startsWith('image/') ? (
                      <PhotoIcon className="h-6 w-6 text-indigo-500 mr-2" />
                    ) : (
                      <VideoCameraIcon className="h-6 w-6 text-indigo-500 mr-2" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={removeFile}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {filePreview && (
                  <div className="mt-2 flex justify-center">
                    {file.type.startsWith('image/') ? (
                      <img src={filePreview} alt="Preview" className="max-h-64 rounded" />
                    ) : (
                      <video 
                        src={filePreview} 
                        controls 
                        className="max-h-64 rounded" 
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <div className="flex items-center text-red-600 text-sm">
                <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                {uploadError}
              </div>
            )}

            {isUploading && (
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                <span>
                    {uploadPhase === 'uploading' && 'Uploading media...'}
                    {uploadPhase === 'preprocessing' && 'Preprocessing...'}
                    {uploadPhase === 'analyzing_frames' && 'Analyzing video frames...'}
                    {uploadPhase === 'analyzing' && 'Analyzing emotions...'}
                    {uploadPhase === 'generating_visualizations' && 'Generating visualizations...'}
                    {uploadPhase === 'finalizing' && 'Finalizing results...'}
                    {uploadPhase === 'complete' && 'Analysis complete!'}
                </span>
                <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                ></div>
                </div>
                <p className="text-xs text-gray-500">
                {file?.type.startsWith('video/') 
                    ? 'Video analysis may take several minutes depending on length...' 
                    : 'Please wait while we analyze your media...'}
                </p>
            </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!file || isUploading}
                className={`py-2 px-4 rounded-md text-white font-medium 
                  ${!file || isUploading 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  }`}
              >
                {isUploading ? 'Processing...' : 'Analyze'}
              </button>
            </div>
          </form>
        </div>

        {/* Previous Analyses */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Analyses</h2>
          
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading your analyses...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-500">
              <ExclamationCircleIcon className="h-12 w-12 mx-auto text-red-500" />
              <p className="mt-4">{error}</p>
            </div>
          ) : analyses.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <DocumentIcon className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-4">No analyses found</p>
              <p className="mt-2 text-sm">Upload a file to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyses.map((analysis) => (
                <motion.div 
                  key={analysis.analysis_id}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <Link to={`/media-analysis/${analysis.analysis_id}`}>
                    <div className="h-48 bg-gray-200 overflow-hidden">
                      {analysis.thumbnail ? (
                        <img 
                          src={analysis.thumbnail} 
                          alt="Analysis thumbnail" 
                          className="h-full w-full object-cover"
                        />
                      ) : analysis.media_type === 'video' ? (
                        <div className="h-full w-full flex items-center justify-center bg-gray-800">
                          <VideoCameraIcon className="h-16 w-16 text-gray-400" />
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <PhotoIcon className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          analysis.dominant_emotion === 'happy' ? 'bg-green-100 text-green-800' :
                          analysis.dominant_emotion === 'sad' ? 'bg-blue-100 text-blue-800' :
                          analysis.dominant_emotion === 'angry' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {analysis.dominant_emotion}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(analysis.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 truncate">
                        {analysis.media_type === 'video' ? 'Video analysis' : 'Image analysis'}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaAnalysis;