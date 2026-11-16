import { id, one, query, transaction } from "./db";
import { passwordHash, token } from "./security";
export async function seedDemo() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  if (
    await one("SELECT id FROM users WHERE email=$1", ["demo0@alumnex.invalid"])
  )
    return;
  const profiles = [
    [
      "Dr. Amaka Johnson",
      "Consultant Physician",
      "Nigerian HealthTech",
      "Medicine",
      "Medicine and Surgery",
      "2014",
      "Lagos, Nigeria",
      "Healthcare",
      ["Healthcare", "Research", "Digital health"],
      0,
    ],
    [
      "Dr. Sarah Adeyemi",
      "Digital Health Consultant",
      "Health Innovation Practice",
      "Medicine",
      "Medicine and Surgery",
      "2016",
      "Lagos, Nigeria",
      "Healthcare",
      ["Digital health", "Leadership", "Research"],
      1,
    ],
    [
      "David Adebayo",
      "Product Engineer",
      "African Technology Collective",
      "Engineering",
      "Computer Engineering",
      "2018",
      "Abuja, Nigeria",
      "Technology",
      ["Technology", "AI", "Product design"],
      2,
    ],
    [
      "Chinwendu Okeke",
      "Medical Student",
      "ABUAD",
      "Medicine",
      "Medicine and Surgery",
      "2027",
      "Ado-Ekiti, Nigeria",
      "Healthcare",
      ["Research", "Public health"],
      3,
    ],
    [
      "Tunde Olawale",
      "Finance Executive",
      "African Enterprise Group",
      "Management Sciences",
      "Accounting",
      "2013",
      "London, United Kingdom",
      "Finance",
      ["Entrepreneurship", "Finance", "Leadership"],
      4,
    ],
    [
      "Ada Nwosu",
      "Founder & Creative Director",
      "Nwosu Studio",
      "Sciences",
      "Computer Science",
      "2019",
      "Toronto, Canada",
      "Creative Industries",
      ["Design", "Entrepreneurship", "Technology"],
      5,
    ],
  ];
  const disabledPassword = await passwordHash(token());
  let owner = "";
  await transaction(async () => {
    for (let i = 0; i < profiles.length; i++) {
      const [
        name,
        title,
        company,
        faculty,
        department,
        graduation,
        location,
        industry,
        interests,
        avatar,
      ] = profiles[i];
      const userId = id();
      if (!owner) owner = userId;
      await query(
        "INSERT INTO users(id,email,password_hash,name,role,verified,profile,created_at) VALUES($1,$2,$3,$4,$5,1,$6,$7)",
        [
          userId,
          "demo" + i + "@alumnex.invalid",
          disabledPassword,
          name,
          i === 3 ? "student" : "alumni",
          JSON.stringify({
            title,
            company,
            faculty,
            department,
            graduation,
            location,
            industry,
            interests,
            skills: interests,
            avatar,
            bio: "Fictional demonstration profile. Passionate about connecting professional experience with opportunities for the next generation of ABUAD students.",
            mentorAvailable: i !== 3,
            visibility: "network",
            messages: "connections",
          }),
          Date.now(),
        ],
      );
    }
    const future = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const content = [
      [
        "opportunity",
        "Digital Health Research Intern",
        "A fictional demonstration internship exploring healthcare research and digital innovation. This listing is for testing the application journey; it is not a real vacancy.",
        {
          type: "Internship",
          industry: "Healthcare",
          location: "Lagos, Nigeria",
          arrangement: "Hybrid",
          deadline: future(14),
          skills: ["Research", "Healthcare"],
          requirements:
            "Interest in research, clear communication and a healthcare background. Submit a PDF resume and a short statement of interest.",
        },
      ],
      [
        "opportunity",
        "Graduate Product Analyst",
        "A fictional opportunity for ABUAD graduates interested in data-informed product development.",
        {
          type: "Job",
          industry: "Technology",
          location: "Lagos, Nigeria",
          arrangement: "Remote",
          deadline: future(21),
          skills: ["Data analysis", "Communication"],
          requirements:
            "Graduate-level analytical skills and an interest in solving problems.",
        },
      ],
      [
        "opportunity",
        "Research & Innovation Fellowship",
        "A demonstration fellowship connecting academic research with community impact.",
        {
          type: "Fellowship",
          industry: "Healthcare",
          location: "Ado-Ekiti, Nigeria",
          arrangement: "On-site",
          deadline: future(30),
          skills: ["Research", "Leadership"],
        },
      ],
      [
        "event",
        "ABUAD Global Alumni Summit 2026",
        "A fictional demonstration of an alumni networking event. Connect with the people and ideas shaping the ABUAD community. This is not an official event announcement.",
        {
          type: "Networking",
          location: "Lagos, Nigeria",
          industry: "Healthcare",
          startsAt: future(20),
          endsAt: future(21),
          deadline: future(17),
          capacity: 250,
          requirements:
            "Demonstration agenda:\n09:00 Registration\n10:00 Opening\n11:00 Alumni Leadership Panel\n13:00 Networking Lunch\n14:30 Career Connections\n16:00 Closing",
        },
      ],
      [
        "event",
        "Technology & Innovation Forum",
        "A fictional community event for exploring careers in technology and innovation.",
        {
          type: "Career",
          location: "Ado-Ekiti, Nigeria",
          industry: "Technology",
          startsAt: future(35),
          endsAt: future(36),
          deadline: future(30),
          capacity: 100,
        },
      ],
      [
        "community",
        "ABUAD Global Health Network",
        "A demonstration community for healthcare professionals, students and researchers. Share questions, career insights and opportunities.",
        { industry: "Healthcare", location: "Global" },
      ],
      [
        "community",
        "ABUAD Women in Leadership",
        "A demonstration community for sharing experiences, supporting ambitions and building meaningful professional connections.",
        { industry: "Leadership", location: "Global" },
      ],
      [
        "community",
        "ABUAD Technology & Innovation",
        "A demonstration space for builders, thinkers and professionals shaping technology.",
        { industry: "Technology", location: "Global" },
      ],
      [
        "community",
        "ABUAD Medical Alumni Network",
        "A fictional professional community supporting medical alumni and students.",
        { industry: "Healthcare", location: "Global" },
      ],
      [
        "campaign",
        "ABUAD Medical Student Scholarship Fund",
        "A fictional giving campaign used to demonstrate secure donation processing. Do not make real donations to demonstration campaigns.",
        { goal: 15000000, industry: "Healthcare", deadline: future(60) },
      ],
      [
        "announcement",
        "Welcome to the ALUMNEX demonstration",
        "Explore the platform with fictional profiles and listings. This project is not an official ABUAD deployment or university announcement.",
        {},
      ],
    ];
    for (const [kind, title, description, data] of content)
      await query(
        "INSERT INTO resources(id,kind,owner_id,title,description,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)",
        [
          id(),
          kind,
          owner,
          title,
          description,
          "published",
          JSON.stringify(data),
          Date.now(),
        ],
      );
  });
}
