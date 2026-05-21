interface CardBackProps {
  count?: number;
  size?: 'sm' | 'md';
}

export function CardBack({ count, size = 'md' }: CardBackProps) {
  const dims = size === 'sm' ? 'w-8 h-12' : 'w-12 h-18';
  return (
    <div className={`${dims} relative`}>
      <div className="w-full h-full bg-red-800 rounded-lg border-2 border-red-600 shadow-md flex items-center justify-center">
        <div className="w-3/4 h-3/4 rounded border border-red-500 bg-red-700/50" />
      </div>
      {count !== undefined && (
        <span className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-gray-600">
          {count}
        </span>
      )}
    </div>
  );
}
