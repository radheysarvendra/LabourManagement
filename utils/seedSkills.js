const DEFAULT_SKILLS = [
  { skillName: "Mason", defaultWage: 500, category: "construction" },
  { skillName: "Plumber", defaultWage: 600, category: "general" },
  { skillName: "Painter", defaultWage: 400, category: "general" },
  { skillName: "Electrician", defaultWage: 700, category: "electrical" },
  { skillName: "Carpenter", defaultWage: 550, category: "construction" },
  { skillName: "Helper", defaultWage: 300, category: "general" },
];

const seedSkills = async (Skill) => {
  await Promise.all(
    DEFAULT_SKILLS.map((skill) =>
      Skill.findOrCreate({
        where: { skillName: skill.skillName },
        defaults: skill,
      })
    )
  );
};

module.exports = {
  DEFAULT_SKILLS,
  seedSkills,
};
