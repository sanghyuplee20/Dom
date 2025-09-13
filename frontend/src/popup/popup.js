document.addEventListener('DOMContentLoaded', function() {
  console.log('🎮 Speech Recognition Extension popup opened');
  
  const status = document.getElementById('status');
  
  // Check if speech recognition is supported
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('❌ Speech recognition not supported in this browser');
    status.innerHTML = '❌ Speech recognition not supported';
    status.style.color = '#d32f2f';
    document.querySelector('.status').style.background = 'rgba(244, 67, 54, 0.1)';
    document.querySelector('.status').style.borderColor = 'rgba(244, 67, 54, 0.3)';
    return;
  }
  
  // Check if we're on a secure context (HTTPS or localhost)
  const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
  
  if (!isSecureContext) {
    console.warn('⚠️ Microphone access requires HTTPS');
    status.innerHTML = '⚠️ HTTPS required for microphone access';
    status.style.color = '#f57c00';
    document.querySelector('.status').style.background = 'rgba(255, 193, 7, 0.1)';
    document.querySelector('.status').style.borderColor = 'rgba(255, 193, 7, 0.3)';
    return;
  }
  
  console.log('✅ All prerequisites met for speech recognition');
  
  // Add click handler for testing
  status.addEventListener('click', function() {
    console.log('🔍 Status clicked - running diagnostic...');
    
    // Test speech recognition availability
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const testRecognition = new SpeechRecognition();
      
      console.log('🧪 Speech Recognition test passed:', {
        continuous: testRecognition.continuous !== undefined,
        interimResults: testRecognition.interimResults !== undefined,
        lang: testRecognition.lang !== undefined
      });
      
      status.innerHTML = '✅ All systems operational (click to test again)';
    } catch (error) {
      console.error('❌ Speech Recognition test failed:', error);
      status.innerHTML = '❌ Speech Recognition initialization failed';
    }
  });
  
  // Add tooltip on hover
  status.title = 'Click to run diagnostic test';
  
  console.log('🎮 Popup initialization complete');
});