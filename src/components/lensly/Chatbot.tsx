import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnalysisResult } from '@/lib/analyze';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotProps {
  analysisResult?: AnalysisResult | null;
}

export const Chatbot = ({ analysisResult }: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to the bottom of the message container
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Welcome message or context update when photo is analyzed
  useEffect(() => {
    if (analysisResult) {
      setMessages((prev) => {
        // If there's already a context change notice, don't keep appending it.
        const lastMsg = prev[prev.length - 1];
        const notice = `I see you uploaded a new photo: "${analysisResult.title}". Ask me anything about it!`;
        if (lastMsg?.content === notice) return prev;
        return [
          ...prev,
          {
            role: 'assistant',
            content: notice,
          },
        ];
      });
      // Automatically open the chatbot to guide the user
      setIsOpen(true);
    }
  }, [analysisResult]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Build the system prompt with current photo context
      const systemPrompt = `You are Lensly AI, an intelligent vision assistant integrated into Lensly (an AI photo analysis application). 
Your task is to help the user understand their photos and answer general queries.

${
  analysisResult
    ? `The user has successfully uploaded a photo. Here is the current structured analysis of the photo:
- Title: ${analysisResult.title}
- Description: ${analysisResult.description}
- Category: ${analysisResult.category}
- Quality Score: ${analysisResult.quality?.score}/100 (${analysisResult.quality?.notes})
- Detected tags: ${analysisResult.tags?.map((t) => `${t.label} (${t.confidence}% confidence)`).join(', ')}
- Extracted OCR Text: ${analysisResult.ocr?.hasText ? `"${analysisResult.ocr.text}" (${analysisResult.ocr.language})` : 'No text detected'}
- Key Insights: ${analysisResult.insights?.headline} - ${analysisResult.insights?.markdown}

Answer questions with direct reference to the uploaded photo and its details if the user asks about it. Keep your responses concise, friendly, and structured. Use Markdown where helpful.`
    : `The user has not uploaded a photo yet. Guide them to drag & drop or pick an image to analyze it. Answer any general questions they might have about AI vision.`
}
Always maintain a helpful, conversational, and direct tone. Never mention Lovable or the Lovable gateway.`;

      // Construct messages payload
      const payloadMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const { data, error } = await supabase.functions.invoke('text-tools', {
        body: {
          action: 'chat',
          messages: payloadMessages,
        },
      });

      if (error) throw error;
      const resData = data as { error?: string; output?: string } | null;
      if (resData?.error) throw new Error(resData.error);

      const aiResponse = resData?.output;
      if (!aiResponse) throw new Error('Failed to get a response from Lensly AI');

      setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error communicating with AI assistant.';
      toast.error(errMsg);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat history cleared');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-aurora text-primary-foreground shadow-elegant hover:brightness-110 active:scale-95 transition-all duration-200"
        aria-label="Open Chat"
      >
        {isOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-[350px] sm:w-[400px] h-[500px] flex flex-col rounded-3xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-elegant overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="flex size-8 rounded-xl bg-aurora items-center justify-center shadow-elegant">
                  <Bot className="size-4 text-primary-foreground" />
                </span>
                <div>
                  <h3 className="font-display font-medium text-sm text-foreground">Lensly AI</h3>
                  <p className="text-[10px] text-muted-foreground">Ask questions about your photos</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    title="Clear history"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                  <div className="size-12 rounded-2xl glass flex items-center justify-center">
                    <Bot className="size-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">Chat with Lensly AI</h4>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      {analysisResult
                        ? `Ask me anything about "${analysisResult.title}" or what's inside this photo!`
                        : 'Upload a photo to analyze it, then ask me questions about it here.'}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`size-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        msg.role === 'user' ? 'bg-secondary' : 'bg-aurora'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <User className="size-4 text-foreground" />
                      ) : (
                        <Bot className="size-4 text-primary-foreground" />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-card border border-border/60 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="size-8 rounded-xl bg-aurora flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="size-4 text-primary-foreground" />
                  </div>
                  <div className="rounded-2xl px-3.5 py-2 text-sm bg-card border border-border/60 rounded-tl-none flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-card border-t border-border/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={analysisResult ? "Ask about this photo..." : "Ask a question..."}
                disabled={loading}
                className="flex-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="flex size-9 items-center justify-center rounded-xl bg-aurora text-primary-foreground shadow-elegant hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                <Send className="size-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
