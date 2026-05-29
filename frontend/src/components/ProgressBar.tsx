interface Props {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ value, showLabel = true, size = 'md' }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  let color = 'bg-green-500';
  if (clamped < 25) color = 'bg-red-500';
  else if (clamped < 50) color = 'bg-orange-500';
  else if (clamped < 75) color = 'bg-yellow-500';

  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-2 w-full">
      <div className={`flex-1 bg-gray-100 rounded-full overflow-hidden ${h}`}>
        <div
          className={`${color} ${h} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-gray-500 w-10 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
