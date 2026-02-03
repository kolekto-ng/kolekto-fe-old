

export default function PlaceholderStep({ title, back, next }) {
  return (
    <section>
      <button onClick={back} className="mb-6 text-sm text-neutral-600">
        ← Back
      </button>

      <h2 className="text-xl font-semibold">{title}</h2>

      <button
        onClick={next}
        className="mt-6 w-full rounded-lg bg-green-600 py-3 text-white"
      >
        Continue
      </button>
    </section>
  );
}




