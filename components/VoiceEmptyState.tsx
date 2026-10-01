type Props = {
  message: string;
  className?: string;
};

/**
 * Short floor under a mic or speaker when there is nothing to hear yet.
 * Status, not an alert — the red voice box is for a failed call.
 */
export function VoiceEmptyState({ message, className = "" }: Props) {
  return (
    <p role="status" className={`text-base leading-snug text-tan ${className}`}>
      {message}
    </p>
  );
}
