/** The "finsight" wordmark with its four-point spark. */
export default function BrandLogo() {
  return (
    <span className="brand-logo" aria-label="finsight">
      <span className="brand-logo-word" aria-hidden="true">
        finsight
        <svg className="brand-logo-word-spark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 0c1.18 9.62 6.38 14.82 16 16-9.62 1.18-14.82 6.38-16 16C14.82 22.38 9.62 17.18 0 16 9.62 14.82 14.82 9.62 16 0Z" />
        </svg>
      </span>
    </span>
  );
}
