'use client';

import Link from 'next/link';

// Video Embed Component - YouTube video
function VideoEmbed() {
  const videoId = 'kmkLKYQOkNs'; // Extracted from https://youtu.be/kmkLKYQOkNs
  
  // YouTube embed parameters to minimize branding
  const embedParams = new URLSearchParams({
    'modestbranding': '1',      // Reduces YouTube branding
    'rel': '0',                 // Doesn't show related videos from other channels
    'showinfo': '0',            // Hides video info (deprecated but still works)
    'iv_load_policy': '3',      // Hides annotations
    'cc_load_policy': '0',      // Hides captions by default
    'playsinline': '1',         // Plays inline on mobile
    'controls': '1',            // Shows video controls
    'fs': '1'                   // Allows fullscreen
  });
  
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`}
      className="w-full h-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      title="VANA Health Check In System Tutorial"
    />
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">VANA Health</h1>
            <Link
              href="/register?role=client"
              className="inline-flex items-center px-4 py-2 bg-[#daa450] hover:bg-[#c89440] text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
            >
              Sign Up Now
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-block bg-red-100 border-2 border-red-400 rounded-full px-4 py-2 mb-6">
            <span className="text-red-700 font-bold text-sm sm:text-base">🔴 LIVE</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            VANA HEALTH ONLINE CHECK IN SYSTEM V1
          </h1>
          <p className="text-xl sm:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            IS LIVE 🔴
          </p>
        </div>

        {/* Introduction Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 lg:p-10 mb-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 text-lg leading-relaxed mb-4">
              Ok - so this has been months in the planning and making and we are excited to be able to launch this. 
              This is personally coded and developed for <strong className="text-gray-900">VANA Health</strong> - we haven't bought a whitelabel program. 
              We have <strong className="text-gray-900">full control</strong> of the code and development of this - so we can get your full feedback on it and we can fix it fairly promptly.
            </p>
          </div>
        </div>

        {/* Video Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 lg:p-10 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
            📹 Watch This Video First
          </h2>
          <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-4">
            {/* Video Embed - Replace VIDEO_EMBED_URL with your actual video URL */}
            {/* For YouTube: Use format: https://www.youtube.com/embed/VIDEO_ID */}
            {/* For Vimeo: Use format: https://player.vimeo.com/video/VIDEO_ID */}
            {/* Or paste full iframe embed code in the VideoEmbed component below */}
            <VideoEmbed />
          </div>
          <p className="text-center text-gray-600 italic">
            Watch this video in full...if you have any questions, watch it again
          </p>
        </div>

        {/* Steps Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 lg:p-10 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
            NEXT STEPS:
          </h2>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                1️⃣
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-lg leading-relaxed">
                  <strong>Watch this video in full...</strong>if you have any questions, watch it again
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                2️⃣
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-lg leading-relaxed mb-3">
                  <strong>Sign up:</strong>
                </p>
                <Link
                  href="https://checkinv5.web.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-[#daa450] hover:bg-[#c89440] text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  https://checkinv5.web.app/
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                3️⃣
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-lg leading-relaxed">
                  <strong>Complete Onboarding Questions and Photos/Measurements</strong>
                </p>
              </div>
            </div>

            {/* Step 4 - Silvi Message */}
            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border-2 border-green-300">
              <div className="flex-shrink-0 w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                ✓
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-lg leading-relaxed font-medium">
                  Silvi will take it from here and will be in touch!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-blue-50 rounded-2xl shadow-xl border border-blue-200 p-6 sm:p-8 lg:p-10 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            🐛 Found an Issue?
          </h3>
          <p className="text-gray-700 leading-relaxed">
            If you find any issues, bugs etc...can you screenshot or give me an idea how you came about the problem so I can locate and fix it.
          </p>
        </div>

        {/* Recommendation Section */}
        <div className="bg-yellow-50 rounded-2xl shadow-xl border border-yellow-200 p-6 sm:p-8 lg:p-10 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            💡 RECOMMENDED
          </h3>
          <p className="text-gray-700 leading-relaxed">
            Sign up on a laptop/desktop computer initially. We are working on mobile optimisation for the sign up.
          </p>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-6 text-lg">
            Join VANA Health and start your journey today
          </p>
          <Link
            href="/register?role=client"
            className="inline-flex items-center px-8 py-4 bg-[#daa450] hover:bg-[#c89440] text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Sign Up Now
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} VANA Health. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
