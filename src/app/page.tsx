import type { LucideIcon } from "lucide-react";
import { Github, Linkedin } from "lucide-react";

const profileLinks: {
  href: string;
  icon: LucideIcon;
  label: string;
  style: string;
}[] = [
  {
    href: "https://github.com/giacomoguidotto",
    icon: Github,
    label: "GitHub",
    style: "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800",
  },
  {
    href: "https://www.linkedin.com/in/giacomo-guidotto/",
    icon: Linkedin,
    label: "LinkedIn",
    style: "border-[#0A66C2] bg-[#0A66C2] text-white hover:bg-[#004182]",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#171717]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between gap-6 text-sm">
          <a className="font-mono text-neutral-700" href="/">
            guidotto.dev
          </a>
          <span className="font-mono text-neutral-500">
            Portfolio in progress
          </span>
        </header>

        <div className="grid flex-1 content-center gap-10 py-20">
          <div className="max-w-3xl">
            <p className="mb-5 font-mono text-neutral-500 text-sm">
              Giacomo Guidotto
            </p>
            <h1 className="text-balance font-semibold text-5xl leading-[1.02] sm:text-6xl">
              Backend-focused software engineer building toward AI-native
              product and systems work.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-700 leading-8">
              Production experience across Go services, React and Next.js
              frontends, IoT platform integrations, and ML-adjacent data
              pipelines.
            </p>
          </div>

          <div className="grid gap-4 border-neutral-300 border-y py-6 sm:grid-cols-3">
            <p className="text-neutral-700">
              Go microservices, MQTT and Kafka integrations, and platform
              reliability work.
            </p>
            <p className="text-neutral-700">
              React and Next.js product surfaces with public OSS project
              evidence.
            </p>
            <p className="text-neutral-700">
              Python, PyTorch, and Physics-Informed Neural Network tooling.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {profileLinks.map((link) => (
              <a
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 font-medium text-sm transition-colors ${link.style}`}
                href={link.href}
                key={link.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <link.icon aria-hidden="true" className="size-4" />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <footer className="font-mono text-neutral-500 text-sm">
          Full portfolio coming online from public-safe source material.
        </footer>
      </section>
    </main>
  );
}
