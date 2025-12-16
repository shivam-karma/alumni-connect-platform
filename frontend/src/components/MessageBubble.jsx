// frontend/src/components/MessageBubble.jsx
export default function MessageBubble({ message, isMine }) {
  const cls = isMine ? "self-end bg-blue-600 text-white rounded-bl-lg rounded-tl-lg rounded-tr-lg p-3 max-w-[70%]" :
    "self-start bg-gray-100 text-gray-800 rounded-br-lg rounded-tl-lg rounded-tr-lg p-3 max-w-[70%]";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} `}>
      <div className={cls}>
        <div className="text-sm">{message.text}</div>
        <div className="text-xs text-gray-300 mt-1">{new Date(message.createdAt || message.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
