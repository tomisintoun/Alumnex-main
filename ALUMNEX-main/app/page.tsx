import Link from "next/link";
import {
  ArrowRight,
  Network,
  Compass,
  GraduationCap,
  BriefcaseBusiness,
  CalendarDays,
  Heart,
  ShieldCheck,
  MoveUpRight,
} from "lucide-react";
import { Brand, Action, Avatar, Badge } from "@/components/ui";
export default function Welcome() {
  return (
    <main className="welcome">
      <header className="welcome-nav">
        <Brand />
        <nav>
          <a href="#possibilities">Your possibilities</a>
          <a href="#community">Our community</a>
          <Link href="/security">Your privacy</Link>
        </nav>
        <div className="row">
          <Action href="/login" tone="ghost">
            Sign In
          </Action>
          <Action href="/signup">
            Join the network
            <ArrowRight size={16} />
          </Action>
        </div>
      </header>
      <section className="welcome-hero">
        <div className="hero-copy">
          <Badge>THE ABUAD ALUMNI NETWORK</Badge>
          <h1>
            A shared beginning.
            <br />
            <em>A world of possibilities.</em>
          </h1>
          <p>
            Your ABUAD network doesn’t end at graduation. Find your people,
            discover your next opportunity and help someone else take their
            first step.
          </p>
          <div className="row">
            <Action href="/signup">
              Find your next chapter
              <ArrowRight size={18} />
            </Action>
            <a href="#possibilities" className="button secondary">
              Explore ALUMNEX
            </a>
          </div>
          <div className="social-proof">
            <div className="avatar-stack">
              {[0, 1, 2, 4].map((i) => (
                <Avatar
                  key={i}
                  index={i}
                  name="Illustrative African professional"
                  size={40}
                />
              ))}
            </div>
            <span>
              Students. Alumni. Mentors.
              <br />
              <strong>One ABUAD community.</strong>
            </span>
          </div>
        </div>
        <div
          className="hero-network"
          aria-label="Illustration of the connected alumni community"
        >
          <svg viewBox="0 0 560 560" aria-hidden="true">
            <circle cx="280" cy="280" r="210" />
            <circle cx="280" cy="280" r="145" />
            <path d="M280 280 110 120M280 280 450 120M280 280 100 390M280 280 440 410M110 120 450 120M100 390 440 410" />
          </svg>
          <div className="network-core">
            <Network size={38} />
            <strong>ABUAD</strong>
            <small>CONNECTED FOR LIFE</small>
          </div>
          {[
            [0, "Mentorship", "top-left"],
            [1, "Digital Health", "top-right"],
            [2, "Opportunities", "bottom-left"],
            [3, "Your next chapter", "bottom-right"],
          ].map(([i, t, c]) => (
            <div key={String(i)} className={"network-person " + c}>
              <Avatar index={Number(i)} name={String(t)} size={82} />
              <span>{t}</span>
            </div>
          ))}
          <div className="network-note">
            <ShieldCheck size={18} />
            <span>
              Meaningful connections.
              <br />
              <strong>Rooted in ABUAD.</strong>
            </span>
          </div>
        </div>
      </section>
      <section id="possibilities" className="possibilities">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WHAT COMES NEXT, STARTS HERE</span>
            <h2>Your network. Your next chapter.</h2>
          </div>
          <p>
            A lifetime of possibilities, built around the people who share your
            beginning.
          </p>
        </div>
        <div className="grid three">
          {[
            [
              GraduationCap,
              "Find your guide",
              "Learn from alumni who have already walked the path you’re taking.",
            ],
            [
              BriefcaseBusiness,
              "Open new doors",
              "Discover jobs, internships and research across your network.",
            ],
            [
              CalendarDays,
              "Be part of something",
              "Reconnect at events and find communities that share your interests.",
            ],
          ].map(([Icon, title, body], i) => {
            const I = Icon as typeof Compass;
            return (
              <Link href="/signup" className="feature-card" key={i}>
                <I size={28} />
                <h3>{String(title)}</h3>
                <p>{String(body)}</p>
                <MoveUpRight size={20} />
              </Link>
            );
          })}
        </div>
      </section>
      <section id="community" className="community-band">
        <div>
          <span className="eyebrow">
            A COMMUNITY THAT MOVES FORWARD, TOGETHER
          </span>
          <h2>
            What you know could change
            <br />
            someone else’s future.
          </h2>
          <p>
            Share your experience. Mentor a student. Create an opportunity. Give
            back to the community that helped you begin.
          </p>
          <Action href="/signup">
            Be someone’s next connection
            <Heart size={17} />
          </Action>
        </div>
        <div className="community-mosaic">
          {[0, 4, 5].map((i) => (
            <Avatar
              key={i}
              index={i}
              name="Illustrative African professional"
              size={130}
            />
          ))}
        </div>
      </section>
      <footer>
        <Brand small />
        <span>Afe Babalola University, Ado-Ekiti</span>
        <Link href="/security">Security & privacy</Link>
        <small>ALUMNEX is a project prototype for the ABUAD community.</small>
      </footer>
    </main>
  );
}
