import { useEffect } from "react";

export default function Toast({ message, onClose = ()=>{}, duration = 3500 }) {
  useEffect(() => {
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [onClose, duration]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 bg-black/80 text-white px-4 py-2 rounded shadow">
      {message}
    </div>
  );
}
