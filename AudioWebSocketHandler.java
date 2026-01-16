import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Component
public class AudioWebSocketHandler extends BinaryWebSocketHandler {

    private final GeminiService geminiService;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public AudioWebSocketHandler(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.put(session.getId(), session);
        session.sendMessage(new TextMessage("Connected to transcription service"));
        System.out.println("Client connected: " + session.getId());
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        byte[] audioChunk = message.getPayload().array();
        
        // Process with reactive streaming for better performance
        geminiService.streamTranscription(audioChunk)
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                    transcription -> {
                        try {
                            if (session.isOpen()) {
                                session.sendMessage(new TextMessage(transcription));
                            }
                        } catch (Exception e) {
                            System.err.println("Error sending message: " + e.getMessage());
                        }
                    },
                    error -> System.err.println("Transcription error: " + error.getMessage())
                );
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
        System.out.println("Client disconnected: " + session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("Transport error for session " + session.getId() + ": " + exception.getMessage());
        sessions.remove(session.getId());
    }
}
