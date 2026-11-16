import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "../src/server/session";

export default async function Landing() {
  if (await readSession()) redirect("/home");
  return (
    <>
      <h1>Echo of Me</h1>
      <p className="tagline">Because your love deserves a voice beyond time.</p>
      <div className="card">
        <p>
          Echo of Me helps you preserve your own memories, values and guidance, in your own words and voice,
          for the people you choose.
        </p>
        <p className="muted">
          You decide what is kept and who may see each piece. When someone later asks a question, Echo of Me
          answers only from what you recorded and approved, shows where each answer came from, and says plainly
          when you never recorded anything about it. It is an AI interface to your recorded material. It is never you.
        </p>
        <div className="actions">
          <Link className="button" href="/sign-in">Start your legacy</Link>
        </div>
      </div>
      <div className="notice info small">
        This is a pre-release test build. Please do not store real personal memories in it yet.
      </div>
    </>
  );
}
