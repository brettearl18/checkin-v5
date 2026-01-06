'use client';

import { useState } from 'react';

interface MeasurementData {
  bodyWeight?: number;
  measurements?: {
    waist?: number;
    hips?: number;
    chest?: number;
    leftThigh?: number;
    rightThigh?: number;
    leftArm?: number;
    rightArm?: number;
    // Extended measurements (optional)
    shoulders?: number;
    neck?: number;
    leftBicep?: number;
    rightBicep?: number;
    leftForearm?: number;
    rightForearm?: number;
    leftCalf?: number;
    rightCalf?: number;
  };
  date?: string | Date;
}

interface BodyMeasurementsVisualizationProps {
  measurementData: MeasurementData;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  showComments?: boolean;
  onAddComment?: (comment: string) => void;
  comments?: Array<{ id: string; text: string; author: string; date: Date | string }>;
  // Custom image/video configuration
  customImageUrl?: string; // Path to your custom silhouette image or video (e.g., '/images/custom-silhouette.png' or .mp4)
  useCustomImage?: boolean; // Set to true to use custom image/video instead of default SVG
  isVideo?: boolean; // Set to true if customImageUrl is a video file (e.g., .mp4)
}

export default function BodyMeasurementsVisualization({
  measurementData,
  onEdit,
  onDelete,
  showActions = true,
  showComments = true,
  onAddComment,
  comments = [],
  customImageUrl = '/images/body-measurement-silhouette.png', // Default custom image path
  useCustomImage = false, // Set to true to enable custom image/video
  isVideo = false // Set to true if customImageUrl is a video file
}: BodyMeasurementsVisualizationProps) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  // Calculate BMI (if height is available - you may need to fetch from client profile)
  const calculateBMI = (weight: number, height?: number): number | null => {
    // If height not provided, return null
    // You might want to fetch height from client profile
    if (!height || height <= 0) return null;
    const heightInMeters = height / 100; // Assuming height in cm
    return weight / (heightInMeters * heightInMeters);
  };

  const getBMICategory = (bmi: number): { label: string; color: string } => {
    if (bmi < 18.5) return { label: 'Under', color: 'bg-blue-500' };
    if (bmi < 25) return { label: 'Normal', color: 'bg-green-500' };
    if (bmi < 30) return { label: 'Over', color: 'bg-orange-500' };
    return { label: 'Obese', color: 'bg-red-500' };
  };

  const measurements = measurementData.measurements || {};
  const bodyWeight = measurementData.bodyWeight;

  // Measurement points configuration for the SVG
  // These are relative positions on the human silhouette
  const measurementPoints = {
    shoulders: { x: 50, y: 15, label: 'Shoulders', value: measurements.shoulders },
    neck: { x: 50, y: 18, label: 'Neck', value: measurements.neck },
    chest: { x: 50, y: 28, label: 'Chest', value: measurements.chest },
    leftBicep: { x: 25, y: 30, label: 'Left Bicep', value: measurements.leftBicep },
    rightBicep: { x: 75, y: 30, label: 'Right Bicep', value: measurements.rightBicep },
    leftForearm: { x: 20, y: 45, label: 'Left Forearm', value: measurements.leftForearm },
    rightForearm: { x: 80, y: 45, label: 'Right Forearm', value: measurements.rightForearm },
    waist: { x: 55, y: 40, label: 'Waist', value: measurements.waist }, // Belly button area
    hips: { x: 38, y: 45, label: 'Hips', value: measurements.hips }, // Widest point of hips on left side
    leftThigh: { x: 42, y: 55, label: 'Left Thigh', value: measurements.leftThigh }, // Moved up higher
    rightThigh: { x: 58, y: 55, label: 'Right Thigh', value: measurements.rightThigh }, // Moved up higher
    leftCalf: { x: 40, y: 88, label: 'Left Calf', value: measurements.leftCalf },
    rightCalf: { x: 60, y: 88, label: 'Right Calf', value: measurements.rightCalf },
    // Fallback for leftArm/rightArm (if bicep not available) - moved up to point at bicep
    leftArm: { x: 25, y: 30, label: 'Left Arm', value: measurements.leftArm && !measurements.leftBicep ? measurements.leftArm : undefined },
    rightArm: { x: 75, y: 30, label: 'Right Arm', value: measurements.rightArm && !measurements.rightBicep ? measurements.rightArm : undefined },
  };

  // Filter out measurements without values
  const activeMeasurements = Object.entries(measurementPoints)
    .filter(([_, point]) => point.value !== undefined && point.value !== null && point.value > 0)
    .map(([key, point]) => ({ key, ...point }));

  const formatDate = (date?: string | Date) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b-2 border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Body Measurements</h3>
            {measurementData.date && (
              <p className="text-sm text-gray-600 mt-0.5">{formatDate(measurementData.date)}</p>
            )}
          </div>
          {showActions && (
            <div className="flex items-center space-x-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  EDIT STATS
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-6">
        {/* Left Panel - Summary Stats */}
        <div className="lg:col-span-3 space-y-4">
          {/* Body Weight */}
          {bodyWeight && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Body weight</div>
              <div className="text-2xl font-bold text-gray-900">{bodyWeight} kg</div>
            </div>
          )}

          {/* Body Fat (if available) */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">Body fat</div>
            <div className="text-2xl font-bold text-gray-400">-</div>
            <div className="text-xs text-gray-500 mt-1">Not measured</div>
          </div>

          {/* BMI (if weight available) */}
          {bodyWeight && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-2">Body mass index</div>
              <div className="text-2xl font-bold text-gray-900 mb-3">
                {/* BMI calculation would require height - placeholder for now */}
                <span className="text-gray-400">-</span>
              </div>
              {/* BMI Scale */}
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-blue-400"></div>
                  <div className="flex-1 bg-green-400"></div>
                  <div className="flex-1 bg-orange-400"></div>
                  <div className="flex-1 bg-red-400"></div>
                </div>
                {/* BMI Indicator */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-800" style={{ left: '50%' }}>
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-gray-800 rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>15</span>
                <span>25</span>
                <span>30</span>
                <span>40</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - Human Silhouette with Measurements */}
        <div className="lg:col-span-6 flex items-center justify-center bg-gray-50 rounded-xl p-8 border border-gray-200">
          <div className="relative w-full max-w-md">
            {useCustomImage && customImageUrl ? (
              /* Custom Image/Video Option */
              <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                {isVideo ? (
                  <video
                    src={customImageUrl}
                    className="w-full h-full object-contain"
                    style={{ opacity: 0.3 }}
                    playsInline
                    autoPlay
                    muted
                    onEnded={(e) => {
                      // Freeze on final frame when video ends
                      const video = e.currentTarget;
                      video.pause();
                      // Ensure we're at the last frame
                      if (video.duration) {
                        video.currentTime = video.duration;
                      }
                    }}
                    onError={(e) => {
                      console.error('Custom video failed to load:', customImageUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <img
                    src={customImageUrl}
                    alt="Body silhouette"
                    className="w-full h-full object-contain"
                    style={{ opacity: 0.3 }}
                    onError={(e) => {
                      console.error('Custom image failed to load:', customImageUrl);
                      // Fallback to default SVG if image fails
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Measurement Lines and Labels - Overlay on custom image */}
                  {activeMeasurements.map((point, index) => {
                    const isLeft = point.x < 50;
                    const labelX = isLeft ? point.x - 12 : point.x + 12;
                    const lineEndX = isLeft ? point.x - 10 : point.x + 10;

                    return (
                      <g key={point.key} className="measurement-point">
                        <line
                          x1={point.x}
                          y1={point.y}
                          x2={lineEndX}
                          y2={point.y}
                          stroke="#3b82f6"
                          strokeWidth="0.3"
                          strokeLinecap="round"
                        />
                        <rect
                          x={labelX - 6}
                          y={point.y - 2.5}
                          width="12"
                          height="5"
                          rx="0.5"
                          fill="white"
                          stroke="#3b82f6"
                          strokeWidth="0.2"
                        />
                        <text
                          x={labelX}
                          y={point.y + 0.8}
                          textAnchor="middle"
                          fontSize="2.5"
                          fill="#1e40af"
                          fontWeight="600"
                          className="font-sans"
                        >
                          {point.value?.toFixed(1)}
                        </text>
                        <text
                          x={labelX}
                          y={point.y - 3.5}
                          textAnchor="middle"
                          fontSize="1.8"
                          fill="#6b7280"
                          className="font-sans"
                        >
                          {point.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              /* Default SVG Silhouette */
              <svg
              viewBox="0 0 100 100"
              className="w-full h-auto"
              style={{ maxHeight: '600px' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Human Silhouette - Simplified outline */}
              <g opacity="0.3">
                {/* Head */}
                <ellipse cx="50" cy="10" rx="6" ry="8" fill="none" stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="2,2" />
                {/* Neck */}
                <rect x="48" y="16" width="4" height="3" fill="none" stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="2,2" />
                {/* Torso */}
                <path
                  d="M 45 19 Q 50 20 55 19 L 57 50 Q 50 52 43 50 Z"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                {/* Arms */}
                <path
                  d="M 45 25 L 30 35 L 25 45 L 25 50"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <path
                  d="M 55 25 L 70 35 L 75 45 L 75 50"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                {/* Legs */}
                <path
                  d="M 43 50 L 42 75 L 40 90"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <path
                  d="M 57 50 L 58 75 L 60 90"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              </g>

              {/* Measurement Lines and Labels */}
              {activeMeasurements.map((point, index) => {
                // Calculate line position and label offset
                const isLeft = point.x < 50;
                const labelX = isLeft ? point.x - 12 : point.x + 12;
                const lineStartX = isLeft ? point.x - 4 : point.x + 4;
                const lineEndX = isLeft ? point.x - 10 : point.x + 10;

                return (
                  <g key={point.key} className="measurement-point">
                    {/* Line from body to label */}
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={lineEndX}
                      y2={point.y}
                      stroke="#3b82f6"
                      strokeWidth="0.3"
                      strokeLinecap="round"
                    />
                    {/* Measurement Label Background */}
                    <rect
                      x={labelX - 6}
                      y={point.y - 2.5}
                      width="12"
                      height="5"
                      rx="0.5"
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth="0.2"
                    />
                    {/* Measurement Value */}
                    <text
                      x={labelX}
                      y={point.y + 0.8}
                      textAnchor="middle"
                      fontSize="2.5"
                      fill="#1e40af"
                      fontWeight="600"
                      className="font-sans"
                    >
                      {point.value?.toFixed(1)}
                    </text>
                    {/* Measurement Label */}
                    <text
                      x={labelX}
                      y={point.y - 3.5}
                      textAnchor="middle"
                      fontSize="1.8"
                      fill="#6b7280"
                      className="font-sans"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            )}
          </div>
        </div>

        {/* Right Panel - Comments */}
        {showComments && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 h-full flex flex-col">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Comments</h4>
              
              {comments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-12 h-12 text-gray-300 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <p className="text-xs text-gray-400">No comments added yet</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-white rounded-lg p-2 border border-gray-200">
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {comment.author.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-900">{comment.text}</p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {comment.author} • {formatDate(comment.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Input */}
              {onAddComment && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  {showCommentInput ? (
                    <div className="space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            if (commentText.trim()) {
                              onAddComment(commentText.trim());
                              setCommentText('');
                              setShowCommentInput(false);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Post
                        </button>
                        <button
                          onClick={() => {
                            setCommentText('');
                            setShowCommentInput(false);
                          }}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCommentInput(true)}
                      className="w-full px-3 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add a comment...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
