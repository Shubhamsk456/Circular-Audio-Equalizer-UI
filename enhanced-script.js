class AudioTranscriptionApp {
  constructor() {
    this.canvas = document.getElementById('visualizer');
    this.ctx = this.canvas.getContext('2d');
    this.startBtn = document.getElementById('startBtn');
    this.status = document.getElementById('status');
    this.transcript = document.getElementById('transcript');
    
    this.canvas.width = 320;
    this.canvas.height = 320;
    
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.socket = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    
    this.animationId = null;
    this.lastTime = 0;
    
    this.init();
  }
  
  init() {
    this.startBtn.addEventListener('click', () => this.toggleRecording());
  }
  
  async toggleRecording() {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      this.stopRecording();
    }
  }
  
  async startRecording() {
    try {
      this.status.textContent = 'Initializing...';
      
      // Initialize WebSocket connection
      this.initWebSocket();
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Setup Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      
      source.connect(this.analyser);
      
      // Setup MediaRecorder for streaming
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && event.data.size > 0) {
          this.socket.send(event.data);
        }
      };
      
      this.mediaRecorder.start(100); // Send chunks every 100ms
      
      this.isRecording = true;
      this.startBtn.textContent = '⏹️ Stop Recording';
      this.status.textContent = 'Recording... Speak now!';
      
      // Start 60fps animation
      this.animate();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.status.textContent = 'Error: ' + error.message;
    }
  }
  
  stopRecording() {
    this.isRecording = false;
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.socket) {
      this.socket.close();
    }
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.startBtn.textContent = '🎤 Start Recording';
    this.status.textContent = 'Recording stopped';
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  initWebSocket() {
    this.socket = new WebSocket('ws://localhost:8080/audio-stream');
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.status.textContent = 'Connected to transcription service';
    };
    
    this.socket.onmessage = (event) => {
      this.transcript.textContent = event.data;
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.status.textContent = 'Connection error - using offline mode';
      this.simulateTranscription();
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
    };
  }
  
  simulateTranscription() {
    // Fallback simulation if WebSocket fails
    const messages = [
      'Listening for audio...',
      'Processing speech patterns...',
      'Analyzing frequency data...',
      'Simulated transcription active',
      'Real-time audio processing...'
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(interval);
        return;
      }
      this.transcript.textContent = messages[index % messages.length];
      index++;
    }, 2000);
  }
  
  animate(currentTime = 0) {
    if (!this.isRecording) return;
    
    // Ensure 60fps by limiting frame rate
    if (currentTime - this.lastTime >= 16.67) { // ~60fps
      this.draw();
      this.lastTime = currentTime;
    }
    
    this.animationId = requestAnimationFrame((time) => this.animate(time));
  }
  
  draw() {
    if (!this.analyser) return;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 80;
    
    // Clear canvas with fade effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw frequency bars in circle
    const barCount = this.bufferLength;
    const angleStep = (Math.PI * 2) / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const angle = i * angleStep;
      const value = this.dataArray[i];
      const barHeight = (value / 255) * 100;
      
      // Calculate positions
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);
      
      // Create gradient for each bar
      const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, `hsl(${(i * 2) % 360}, 70%, 50%)`);
      gradient.addColorStop(1, `hsl(${(i * 2 + 60) % 360}, 90%, 70%)`);
      
      // Draw bar
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      
      // Add glow effect for high frequencies
      if (value > 128) {
        this.ctx.shadowColor = gradient;
        this.ctx.shadowBlur = 10;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }
    }
    
    // Draw center circle
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fill();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AudioTranscriptionApp();
});