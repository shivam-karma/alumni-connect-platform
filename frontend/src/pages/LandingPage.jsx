import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/60 to-white">
      {/* HERO */}
      <section className="container py-16 text-center max-w-3xl">
        <span className="inline-block text-xs font-semibold bg-yellow-300/80 text-gray-900 px-3 py-1 rounded-full">
          Welcome to Our Community
        </span>

        <h1 className="mt-4 text-5xl md:text-6xl font-extrabold leading-tight">
          Connect. <span className="text-gray-900">Grow.</span>{" "}
          <span className="text-blue-700">Succeed Together.</span>
        </h1>

        <p className="mt-4 text-gray-600">
          Join our thriving alumni community of professionals, entrepreneurs, and innovators.
          Find mentors, discover opportunities, and build lasting connections.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/register" className="btn btn-primary">Get Started</Link>
          <Link to="/login" className="btn">Sign In →</Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
          {[
            { n: "2,500+", t: "Total Alumni" },
            { n: "1,800+", t: "Active Members" },
            { n: "150+", t: "Global Cities" },
            { n: "500+", t: "Success Stories" },
          ].map((s) => (
            <div key={s.t} className="card text-center">
              <div className="text-2xl font-bold">{s.n}</div>
              <div className="text-xs text-gray-600 mt-1">{s.t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-12">
        <div className="container text-center">
          <h2 className="text-2xl font-bold text-blue-700">Everything You Need to Stay Connected</h2>
          <p className="text-gray-600 mt-2">
            Our platform offers tools to help you network, learn, and grow.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mt-8">
            {[
              { t: "Alumni Directory", d: "Connect with alumni across batches and departments." },
              { t: "Events & Meetups", d: "Join reunions, webinars, and networking sessions." },
              { t: "Job Opportunities", d: "Share and discover jobs, internships, and referrals." },
              { t: "Mentorship Program", d: "Find a mentor or become one." },
            ].map((f) => (
              <div key={f.t} className="card text-left">
                <div className="h-10 w-10 rounded-full bg-blue-600 text-white grid place-items-center text-lg">●</div>
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="text-gray-600 text-sm mt-1">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="container py-10">
        <div className="rounded-2xl p-10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-400 text-white text-center">
          <h3 className="text-2xl md:text-3xl font-extrabold">
            Ready to Connect with Your Alumni Community?
          </h3>
          <p className="mt-2 text-blue-100">
            Join thousands of alumni making meaningful connections and creating opportunities.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/register" className="btn bg-white text-blue-700 border-white">Create Your Profile →</Link>
            <Link to="/login" className="btn border-white">Sign In</Link>
          </div>
        </div>
      </section>

      <footer className="container py-6 text-center text-xs text-gray-500 border-t">
        © {new Date().getFullYear()} Alumni Network. All rights reserved.
      </footer>
    </main>
  );
}
