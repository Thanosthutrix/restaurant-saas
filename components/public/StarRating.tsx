import { Star } from "lucide-react";

type Props = {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function StarRating({
  rating,
  max = 5,
  size = "md",
  showValue = false,
  className = "",
}: Props) {
  const iconSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label={`Note ${rating} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = rating >= i + 1;
        const partial = !filled && rating > i && rating < i + 1;

        return (
          <Star
            key={i}
            className={`${iconSize} ${
              filled || partial
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            }`}
            aria-hidden
          />
        );
      })}
      {showValue ? (
        <span className="ml-1 text-sm font-semibold text-slate-800">{rating.toFixed(1)}</span>
      ) : null}
    </div>
  );
}
