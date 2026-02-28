import { useChat } from '@/hooks/use-chat'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'

export function ChatPanel() {
  const { send } = useChat()

  return (
    <div className="flex h-full flex-col">
      <MessageList />
      <ChatInput onSend={send} />
    </div>
  )
}
