import { Hero } from "~/components/hero";
import { Masthead } from "~/components/masthead";

export default function Home() {
  return (
    <main className="page">
      <Masthead />
      <Hero />
    </main>
  );
}
