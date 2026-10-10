import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; lang?: string };

type ChoiceChipsProps<T extends string> = {
  name: string;
  legend: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Single-choice chips built on native radios, so arrow keys and screen readers work for free. */
export function ChoiceChips<T extends string>({ name, legend, options, value, onChange, className }: ChoiceChipsProps<T>) {
  return (
    <fieldset className={cn("flex flex-wrap gap-2", className)}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            lang={option.lang}
            className={cn(
              "inline-flex h-11 items-center rounded-full px-4 text-sm ring-1 ring-line-strong ring-inset transition-colors duration-200",
              "hover:bg-surface-sunken peer-checked:bg-ink peer-checked:text-surface peer-checked:ring-ink",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
