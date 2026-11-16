"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  MapPin,
  CheckCircle2,
  GraduationCap,
  BriefcaseBusiness,
  CalendarDays,
  Users,
  Bookmark,
  Share2,
  Sparkles,
  Heart,
  Search,
  Clock,
} from "lucide-react";
import {
  Action,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Insight,
  Loading,
  Modal,
  SearchBox,
  date,
  money,
} from "./ui";
import { useApp, useData, type Item } from "./app-context";
import { MentorshipRequest } from "./member-views";
import { DonationForm } from "./resource-views";
export function Title({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">ABUAD ALUMNI NETWORK</span>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function DataState({
  state,
  children,
}: {
  state: ReturnType<typeof useData>;
  children: React.ReactNode;
}) {
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorBox message={state.error} retry={state.reload} />;
  return <>{children}</>;
}
export function PersonCard({
  person,
  mentor = false,
}: {
  person: Item;
  mentor?: boolean;
}) {
  const p = person.profile;
  return (
    <Card className="person-card">
      <div className="row between">
        <Avatar name={person.name} index={p.avatar} size={58} />
        {p.mentorAvailable ? (
          <Badge tone="green">Available to mentor</Badge>
        ) : null}
      </div>
      <h3>
        <Link href={"/app/discover/" + person.id}>{person.name}</Link>
        {person.verified ? (
          <CheckCircle2
            className="verified"
            size={16}
            aria-label="Verified alumni"
          />
        ) : null}
      </h3>
      <strong>{p.title || "ABUAD " + person.role}</strong>
      <p>
        {p.company || "ABUAD network"}
        {p.graduation ? " · ABUAD ’" + p.graduation.slice(-2) : ""}
      </p>
      {p.location ? (
        <span className="subtle row">
          <MapPin size={14} />
          {p.location}
        </span>
      ) : null}
      <div className="tags">
        {(p.interests || []).slice(0, 3).map((t: string) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <Action href={"/app/discover/" + person.id} tone="secondary">
        {mentor ? "View mentor" : "View profile"}
        <ArrowRight size={15} />
      </Action>
    </Card>
  );
}
export function HomeView() {
  const { user } = useApp(),
    people = useData("directory?limit=3"),
    insights = useData("insights"),
    opportunities = useData("resources?kind=opportunity&limit=2");
  const first = user!.name.split(" ")[0];
  return (
    <>
      <Title
        title={`Hello, ${first}.`}
        subtitle="Discover people, opportunities and experiences across the ABUAD network."
      />
      <section className="dashboard-hero">
        <div>
          <Badge>YOUR NEXT CHAPTER</Badge>
          <h2>Build your ABUAD network.</h2>
          <p>
            A shared beginning can take you somewhere extraordinary.
            <br />
            Connect with people who can help you take your next step.
          </p>
          <div className="row">
            <Action href="/app/mentors">
              Find a mentor
              <ArrowRight size={16} />
            </Action>
            <Action href="/app/opportunities" tone="white">
              Explore opportunities
            </Action>
          </div>
        </div>
        <div className="hero-people">
          <div>
            {[0, 1, 2].map((i) => (
              <Avatar
                key={i}
                name="Illustrative ABUAD professional"
                index={i}
                size={88}
              />
            ))}
          </div>
          <span>ABUAD → CONNECTION → POSSIBILITY</span>
        </div>
      </section>
      <div className="quick-actions">
        {[
          [GraduationCap, "Find a Mentor", "mentors"],
          [BriefcaseBusiness, "Discover Opportunities", "opportunities"],
          [CalendarDays, "Explore Events", "events"],
          [Users, "Join Communities", "communities"],
        ].map(([Icon, label, slug]) => {
          const I = Icon as typeof Users;
          return (
            <Link key={String(slug)} href={"/app/" + slug}>
              <I size={23} />
              <span>{String(label)}</span>
              <ArrowRight size={16} />
            </Link>
          );
        })}
      </div>
      <div className="section-heading">
        <h2>People you may want to know</h2>
        <Link href="/app/discover">
          Discover alumni <ArrowRight size={15} />
        </Link>
      </div>
      <DataState state={people}>
        {people.data?.items?.length ? (
          <div className="grid three">
            {people.data.items.map((p: Item) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        ) : (
          <Empty
            title="Your network is just beginning."
            body="Verified ABUAD profiles will appear here as members join."
            href="/app/settings"
            label="Complete your profile"
          />
        )}
      </DataState>
      <Insight
        title="A clearer view of your ABUAD network."
        body={
          insights.data
            ? `${insights.data.alumni} verified alumni, ${insights.data.opportunities} open opportunities and ${insights.data.mentorships} active mentorships. Discover where your interests can take you.`
            : "Explore opportunities and mentors using your interests and career goals."
        }
        href="/app/mentors"
      />
      <div className="section-heading">
        <h2>Opportunities for your next step</h2>
        <Link href="/app/opportunities">
          View all <ArrowRight size={15} />
        </Link>
      </div>
      <DataState state={opportunities}>
        {opportunities.data?.items?.length ? (
          <div className="grid two">
            {opportunities.data.items.map((r: Item) => (
              <ResourceCard key={r.id} item={r} />
            ))}
          </div>
        ) : (
          <Empty
            title="New doors will open here."
            body="Verified opportunities appear after administrator approval."
          />
        )}
      </DataState>
    </>
  );
}
export function DirectoryView({ mentors = false }: { mentors?: boolean }) {
  const [search, setSearch] = useState(""),
    [industry, setIndustry] = useState(""),
    [faculty, setFaculty] = useState("");
  const state = useData("directory?q=" + encodeURIComponent(search));
  const people = (state.data?.items || []).filter(
    (p: Item) =>
      (!mentors || p.profile.mentorAvailable) &&
      (!industry || p.profile.industry === industry) &&
      (!faculty || p.profile.faculty === faculty),
  );
  const options = (field: string) =>
    Array.from(
      new Set(
        (state.data?.items || [])
          .map((p: Item) => p.profile[field])
          .filter(Boolean),
      ),
    ) as string[];
  return (
    <>
      <Title
        title={
          mentors
            ? "Find someone who has walked your path."
            : "Discover ABUAD Alumni"
        }
        subtitle={
          mentors
            ? "Find guidance, encouragement and a fresh perspective."
            : "Great connections start with something in common."
        }
        action={
          mentors ? (
            <Action href="/app/mentorship" tone="secondary">
              My mentorships
            </Action>
          ) : undefined
        }
      />
      <div className="filter-bar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search names, skills, locations and graduation years…"
        />
        <select
          aria-label="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        >
          <option value="">All industries</option>
          {options("industry").map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Faculty"
          value={faculty}
          onChange={(e) => setFaculty(e.target.value)}
        >
          <option value="">All faculties</option>
          {options("faculty").map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <DataState state={state}>
        <div className="result-count">
          {people.length} {mentors ? "available mentors" : "profiles"} ·
          Verified ABUAD members
        </div>
        {people.length ? (
          <div className="grid three">
            {people.map((p: Item) => (
              <PersonCard key={p.id} person={p} mentor={mentors} />
            ))}
          </div>
        ) : (
          <Empty
            title="No matches just yet."
            body="Try a different search or remove a filter."
          />
        )}
      </DataState>
    </>
  );
}
export function ProfileView({ id }: { id: string }) {
  const state = useData("directory/" + id),
    { user, api, toast } = useApp();
  const [request, setRequest] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true);
    try {
      await api("connections", "POST", { userId: id });
      toast("Connection request sent.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const p = state.data?.user,
    profile = p?.profile;
  return (
    <DataState state={state}>
      {p ? (
        <>
          <div className="profile-cover">
            <div className="network-lines" />
            <Badge>ABUAD · CONNECTED FOR LIFE</Badge>
          </div>
          <Card className="profile-header">
            <Avatar index={profile.avatar} name={p.name} size={112} />
            <div>
              <h1>
                {p.name}{" "}
                {p.verified ? (
                  <CheckCircle2 className="verified" size={23} />
                ) : null}
              </h1>
              <h3>{profile.title || "ABUAD " + p.role}</h3>
              <p>
                {profile.company}
                {profile.graduation
                  ? " · ABUAD ’" + profile.graduation.slice(-2)
                  : ""}
              </p>
              <p className="subtle row">
                <MapPin size={15} />
                {profile.location || "ABUAD network"}
              </p>
            </div>
            {id !== user!.id ? (
              <div className="row wrap">
                <Button busy={busy} onClick={connect}>
                  Connect
                </Button>
                {state.data.canMessage ? (
                  <Action href={"/app/messages/" + id} tone="secondary">
                    Message
                  </Action>
                ) : null}
                {profile.mentorAvailable ? (
                  <Button tone="secondary" onClick={() => setRequest(true)}>
                    Request mentorship
                  </Button>
                ) : null}
              </div>
            ) : (
              <Action href="/app/settings" tone="secondary">
                Edit profile
              </Action>
            )}
          </Card>
          {error ? <ErrorBox message={error} /> : null}
          <div className="grid profile-columns">
            <div>
              <Card>
                <h2>About</h2>
                <p className="preserve">
                  {profile.bio ||
                    "This member hasn’t added a professional story yet."}
                </p>
              </Card>
              <Card>
                <h2>Education & career</h2>
                <div className="journey">
                  <div>
                    <i />
                    <strong>Afe Babalola University, Ado-Ekiti</strong>
                    <p>
                      {profile.faculty} · {profile.department}
                    </p>
                    <small>
                      {profile.graduation
                        ? "Class of " + profile.graduation
                        : "ABUAD community"}
                    </small>
                  </div>
                  {profile.company ? (
                    <div>
                      <i />
                      <strong>
                        {profile.title || "Professional experience"}
                      </strong>
                      <p>{profile.company}</p>
                    </div>
                  ) : null}
                </div>
              </Card>
              {state.data.feedback?.length ? (
                <Card>
                  <h2>Mentorship feedback</h2>
                  {state.data.feedback.map((f: Item, i: number) => (
                    <blockquote key={i}>
                      <strong>{"★".repeat(f.rating || 0)}</strong>
                      <p>{f.body}</p>
                    </blockquote>
                  ))}
                </Card>
              ) : null}
            </div>
            <div>
              <Card>
                <h2>Areas of expertise</h2>
                <div className="tags">
                  {profile.skills?.length ? (
                    profile.skills.map((t: string) => (
                      <Badge key={t}>{t}</Badge>
                    ))
                  ) : (
                    <p>Not added yet.</p>
                  )}
                </div>
                <h3>Interests</h3>
                <div className="tags">
                  {profile.interests?.map((t: string) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </Card>
              <Insight
                title="A shared ABUAD beginning."
                body="Explore this member’s experience and interests to decide whether this is a useful connection for your goals."
              />
            </div>
          </div>
          {request ? (
            <MentorshipRequest mentor={p} close={() => setRequest(false)} />
          ) : null}
        </>
      ) : null}
    </DataState>
  );
}
const kindRoute: Record<string, string> = {
  opportunity: "opportunities",
  event: "events",
  community: "communities",
  campaign: "giving",
  announcement: "university",
};
export function ResourceCard({ item: r }: { item: Item }) {
  const d = r.data || {},
    deadline = d.deadline ? Date.parse(d.deadline) : 0,
    closing = deadline > Date.now() && deadline - Date.now() < 3 * 86400000,
    expired = deadline > 0 && deadline < Date.now();
  return (
    <Card className={"resource-card " + r.kind}>
      <div className="row between">
        <span className="resource-icon">
          {r.kind === "event" ? (
            <CalendarDays />
          ) : r.kind === "community" ? (
            <Users />
          ) : r.kind === "campaign" ? (
            <Heart />
          ) : (
            <BriefcaseBusiness />
          )}
        </span>
        <Badge tone={expired || closing ? "red" : "blue"}>
          {expired
            ? "Deadline passed"
            : closing
              ? "Closing soon"
              : d.type || r.kind}
        </Badge>
      </div>
      <h3>
        <Link href={"/app/" + kindRoute[r.kind] + "/" + r.id}>{r.title}</Link>
      </h3>
      <p>
        {r.owner_name || "ABUAD network"}{" "}
        {r.owner_verified ? (
          <CheckCircle2 size={13} className="verified" />
        ) : null}
      </p>
      <p className="description">
        {r.description.slice(0, 150)}
        {r.description.length > 150 ? "…" : ""}
      </p>
      <div className="tags">
        {d.location ? (
          <span className="subtle row">
            <MapPin size={14} />
            {d.location}
          </span>
        ) : null}
        {d.arrangement ? <Badge>{d.arrangement}</Badge> : null}
      </div>
      {d.deadline ? (
        <p className={closing || expired ? "deadline" : "subtle"}>
          <Clock size={14} />
          {date(d.deadline)}
        </p>
      ) : null}
      {d.startsAt ? <p className="subtle">{date(d.startsAt)}</p> : null}
      <Link
        href={"/app/" + kindRoute[r.kind] + "/" + r.id}
        className="card-link"
      >
        {r.kind === "event"
          ? "View event"
          : r.kind === "community"
            ? "Explore community"
            : r.kind === "campaign"
              ? "Support campaign"
              : "View opportunity"}
        <ArrowRight size={16} />
      </Link>
    </Card>
  );
}
export function ResourcesView({
  kind,
  saved = false,
  registered = false,
}: {
  kind: string;
  saved?: boolean;
  registered?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [arrangement, setArrangement] = useState("");
  const state = useData(
    saved
      ? "saved"
      : registered
        ? "registrations"
        : "resources?kind=" + kind + "&q=" + encodeURIComponent(search),
  );
  const items = (state.data?.items || []).filter(
    (r: Item) =>
      (!type || r.data.type === type) &&
      (!arrangement || r.data.arrangement === arrangement) &&
      (!saved || r.title.toLowerCase().includes(search.toLowerCase())),
  );
  const titles: Record<string, string> = {
    opportunity: "Your next opportunity is out there.",
    event: "Meet your ABUAD community.",
    community: "Find your ABUAD community.",
    campaign: "Give back. Open doors.",
    announcement: "University announcements",
  };
  const subs: Record<string, string> = {
    opportunity:
      "Jobs, internships, fellowships and research across your network.",
    event: "The people, ideas and experiences that bring us together.",
    community: "Find the people who share your interests and ambitions.",
    campaign: "Help the next generation build an extraordinary future.",
    announcement: "The latest updates from the ABUAD network.",
  };
  return (
    <>
      <Title
        title={
          saved
            ? "Saved opportunities"
            : registered
              ? "Your events"
              : titles[kind]
        }
        subtitle={subs[kind]}
        action={
          kind === "opportunity" ? (
            <div className="row">
              <Action href="/app/saved" tone="secondary">
                Saved
              </Action>
              <Action href="/app/applications" tone="secondary">
                My applications
              </Action>
            </div>
          ) : kind === "event" ? (
            <Action href="/app/registrations" tone="secondary">
              My registrations
            </Action>
          ) : kind === "campaign" ? (
            <Action href="/app/giving/history" tone="secondary">
              My giving
            </Action>
          ) : undefined
        }
      />
      {kind === "campaign" ? (
        <Insight
          title="Your experience can create someone else’s opportunity."
          body="Support administrator-approved ABUAD campaigns. Amounts raised reflect confirmed payments only."
        />
      ) : null}
      <div className="filter-bar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={"Search " + (kindRoute[kind] || "updates") + "…"}
        />
        {kind === "opportunity" ? (
          <>
            <select
              value={type}
              aria-label="Opportunity type"
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              {[
                "Job",
                "Internship",
                "Fellowship",
                "Scholarship",
                "Research",
                "Volunteer",
                "Entrepreneurship",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={arrangement}
              aria-label="Work arrangement"
              onChange={(e) => setArrangement(e.target.value)}
            >
              <option value="">All arrangements</option>
              {["Remote", "Hybrid", "On-site"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </>
        ) : null}
      </div>
      <DataState state={state}>
        {items.length ? (
          <div className="grid three">
            {items.map((r: Item) => (
              <ResourceCard item={r} key={r.id} />
            ))}
          </div>
        ) : (
          <Empty
            title={
              saved
                ? "Save something for your next chapter."
                : "Nothing here yet."
            }
            body={
              saved
                ? "Bookmark opportunities to keep them here."
                : "Approved updates from your ABUAD network will appear here."
            }
            href={saved ? "/app/opportunities" : "/app"}
            label={saved ? "Explore opportunities" : "Back to your network"}
          />
        )}
      </DataState>
    </>
  );
}
export function ResourceView({
  id,
  kind,
  tab,
}: {
  id: string;
  kind: string;
  tab?: string;
}) {
  const state = useData("resources/" + id),
    { api, toast } = useApp();
  const [error, setError] = useState(""),
    [donate, setDonate] = useState(false);
  const r = state.data?.item,
    d = r?.data || {};
  async function save() {
    try {
      await api("saved/" + id, state.data.saved ? "DELETE" : "POST", {});
      state.reload();
      toast(state.data.saved ? "Removed from saved." : "Saved for later.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function calendar() {
    const start = new Date(d.startsAt),
      end = d.endsAt ? new Date(d.endsAt) : new Date(start.getTime() + 7200000);
    const fmt = (v: Date) =>
      v
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const esc = (v: string) =>
      v
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const data = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ALUMNEX//ABUAD//EN",
      "BEGIN:VEVENT",
      "UID:" + r.id + "@alumnex",
      "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(start),
      "DTEND:" + fmt(end),
      "SUMMARY:" + esc(r.title),
      "LOCATION:" + esc(d.location || ""),
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/calendar" }));
    a.download = "alumnex-event.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied.");
    } catch {
      toast("Copy the page address to share this item.");
    }
  }
  return (
    <DataState state={state}>
      {r ? (
        <>
          <Link className="back-link" href={"/app/" + kindRoute[kind]}>
            ← Back to {kindRoute[kind]}
          </Link>
          <Title
            title={r.title}
            subtitle={
              kind === "event"
                ? `${date(d.startsAt)} · ${d.location || "ABUAD network"}`
                : d.location || "ABUAD network"
            }
          />
          <div className="row wrap">
            <Badge>{d.type || kind}</Badge>
            {d.arrangement ? <Badge>{d.arrangement}</Badge> : null}
            {d.deadline ? (
              <Badge
                tone={
                  Date.parse(d.deadline) - Date.now() < 259200000
                    ? "red"
                    : "blue"
                }
              >
                Deadline: {date(d.deadline)}
              </Badge>
            ) : null}
            <Button tone="ghost" onClick={share}>
              <Share2 size={16} />
              Share
            </Button>
          </div>
          {error ? <ErrorBox message={error} /> : null}
          <div className="grid detail-columns">
            <div>
              <Card>
                <h2>
                  {tab === "agenda"
                    ? "Event agenda"
                    : tab === "speakers"
                      ? "Speakers"
                      : "About " +
                        (kind === "campaign"
                          ? "this campaign"
                          : kind === "event"
                            ? "this event"
                            : "the opportunity")}
                </h2>
                <p className="preserve">{r.description}</p>
                {d.requirements ? (
                  <>
                    <h3>
                      {kind === "event"
                        ? "What to expect"
                        : "Requirements & application details"}
                    </h3>
                    <p className="preserve">{d.requirements}</p>
                  </>
                ) : null}
                {d.skills?.length ? (
                  <>
                    <h3>Relevant skills</h3>
                    <div className="tags">
                      {d.skills.map((t: string) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </>
                ) : null}
              </Card>
              {kind === "opportunity" ? (
                <Insight
                  title="Consider your next step."
                  body="Review the requirements, work arrangement and deadline. Your application shares only the profile and resume you explicitly submit."
                />
              ) : null}
            </div>
            <Card className="sticky-card">
              <span className="eyebrow">YOUR NEXT CHAPTER</span>
              <h2>
                {kind === "campaign"
                  ? "Make a difference."
                  : kind === "event"
                    ? "Be part of it."
                    : "Take the next step."}
              </h2>
              {kind === "opportunity" ? (
                <>
                  {d.salary ? <p>{d.salary}</p> : null}
                  <Action href={"/app/opportunities/" + id + "/apply"}>
                    Apply now
                    <ArrowRight size={16} />
                  </Action>
                  <Button tone="secondary" onClick={save}>
                    <Bookmark size={16} />
                    {state.data.saved ? "Saved — remove" : "Save opportunity"}
                  </Button>
                </>
              ) : kind === "event" ? (
                <>
                  {state.data.registered ? (
                    <>
                      <Badge tone="green">You’re registered</Badge>
                      <Button
                        tone="secondary"
                        onClick={async () => {
                          if (!confirm("Cancel your registration?")) return;
                          try {
                            await api("registrations/" + id, "DELETE");
                            state.reload();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Cancel registration
                      </Button>
                    </>
                  ) : (
                    <Action href={"/app/events/" + id + "/register"}>
                      Register for event
                    </Action>
                  )}
                  <Button tone="secondary" onClick={calendar}>
                    Add to calendar
                  </Button>
                  {d.capacity ? <small>Capacity: {d.capacity}</small> : null}
                </>
              ) : (
                <>
                  <strong className="large-number">
                    {money(state.data.raised || 0)}
                  </strong>
                  <p>raised of {money(d.goal || 0)} goal</p>
                  <progress value={state.data.raised || 0} max={d.goal || 1} />
                  <small>{state.data.donors} confirmed donations</small>
                  <Button onClick={() => setDonate(true)}>
                    Support this campaign
                    <Heart size={16} />
                  </Button>
                </>
              )}
              <hr />
              <small>
                Published through the ABUAD network.
                <br />
                Last updated {date(r.updated_at)}.
              </small>
            </Card>
          </div>
          {donate ? (
            <Modal title="Give back to ABUAD" onClose={() => setDonate(false)}>
              <DonationForm campaignId={id} />
            </Modal>
          ) : null}
        </>
      ) : null}
    </DataState>
  );
}
export function SearchView({ query }: { query: string }) {
  const people = useData("directory?q=" + encodeURIComponent(query)),
    opps = useData("resources?kind=opportunity&q=" + encodeURIComponent(query)),
    events = useData("resources?kind=event&q=" + encodeURIComponent(query)),
    communities = useData(
      "resources?kind=community&q=" + encodeURIComponent(query),
    );
  const [tab, setTab] = useState("People");
  const sources: Record<string, ReturnType<typeof useData>> = {
    People: people,
    Opportunities: opps,
    Events: events,
    Communities: communities,
  };
  const state = sources[tab];
  return (
    <>
      <Title
        title="Search the ABUAD network"
        subtitle={`Results for “${query}”`}
      />
      <div className="tabs">
        {Object.keys(sources).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <DataState state={state}>
        {state.data?.items?.length ? (
          <div className="grid three">
            {state.data.items.map((r: Item) =>
              tab === "People" ? (
                <PersonCard key={r.id} person={r} />
              ) : (
                <ResourceCard key={r.id} item={r} />
              ),
            )}
          </div>
        ) : (
          <Empty
            title="No matches found."
            body="Try another name, topic or location."
          />
        )}
      </DataState>
    </>
  );
}
