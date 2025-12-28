export function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle,rgba(212,165,116,0.2),rgba(212,165,116,0)_65%)] blur-3xl animate-sun-pulse" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(212,165,116,0.135),rgba(212,165,116,0)_70%)] blur-3xl" />
    </div>
  );
}
