export type ExperienceItem = {
  id: string;
  year: string;
  role: string;
  company: string;
  description: string;
  technologies: string[];
  type: "work" | "education";
  current?: boolean;
};

export const experience: ExperienceItem[] = [
  {
    id: "zenvyrolabs",
    year: "2026",
    role: "Full Stack Web Development Intern",
    company: "Zenvyro Labs (Pvt) Ltd.",
    description:
      "Completed a Full Stack Web Internship at Zenvyro Labs (13 July – 13 August 2026), building full-stack web applications with React, Node.js and Express, REST APIs, authentication and database-backed features in a collaborative team workflow.",
    technologies: ["React", "Next.js", "Node.js", "Express.js", "PostgreSQL", "Git"],
    type: "work",
  },

  {
    id: "devops-internship",
    year: "2025",
    role: "DevOps Intern",
    company: "Internship",
    description:
      "Learned Docker, Jenkins, Linux, CI/CD pipelines and deployment automation while working on practical DevOps projects.",
    technologies: ["Docker", "Jenkins", "Linux", "CI/CD", "Kubernetes"],
    type: "work",
  },

  {
    id: "sps-frontend",
    year: "2025",
    role: "Frontend Developer",
    company: " Internship",
    description:
      "Built responsive interfaces using HTML, CSS and JavaScript while learning UI development and best practices.",
    technologies: ["HTML", "CSS", "JavaScript"],
    type: "work",
  },

  {
    id: "ned-bscs",
    year: "2023",
    role: "BS Computer Science",
    company: "NED University",
    description:
      "Started Computer Science with specialization in Gaming & Animation while developing projects in web and game development.",
    technologies: ["Unity", "C#", "C++", "Game Development"],
    type: "education",
  },
];