import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class GeminiService {
    
    private final AtomicInteger chunkCounter = new AtomicInteger(0);
    
    public Mono<String> streamTranscription(byte[] audioChunk) {
        return Mono.fromCallable(() -> processAudioChunk(audioChunk))
                .delayElement(Duration.ofMillis(50)); // Simulate low latency
    }
    
    public Flux<String> streamContinuousTranscription(Flux<byte[]> audioStream) {
        return audioStream
                .map(this::processAudioChunk)
                .distinctUntilChanged()
                .delayElements(Duration.ofMillis(100));
    }
    
    private String processAudioChunk(byte[] audioChunk) {
        int size = audioChunk.length;
        int count = chunkCounter.incrementAndGet();
        
        // Simulate progressive transcription based on audio data
        if (size < 100) return "[Silence]";
        if (size < 500) return "Listening...";
        if (size < 1500) return "Processing speech...";
        if (size < 3000) return "Hello";
        if (count % 10 < 3) return "Hello, this is";
        if (count % 10 < 6) return "Hello, this is live";
        return "Hello, this is live transcription working in real-time";
    }
    
    // Simulate Gemini API streaming response
    public Flux<String> simulateGeminiStreaming(byte[] audioChunk) {
        String[] words = processAudioChunk(audioChunk).split(" ");
        return Flux.fromArray(words)
                .delayElements(Duration.ofMillis(200))
                .scan("", (acc, word) -> acc.isEmpty() ? word : acc + " " + word);
    }
}
