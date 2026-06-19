const { Op } = require("sequelize");
const db = require("../../model");

const SELECTION_RULES = {
  maxCategories: 6,
  maxSkillsPerCategory: 2,
  maxTotalSkills: 6,
};

const skillInclude = {
  model: db.categorySkill,
  as: "categorySkills",
  where: { isActive: true },
  required: false,
  include: [{ model: db.skill, as: "skill" }],
};

const categoryInclude = [skillInclude];

const normalizeText = (value) => String(value || "").trim();

const mapCategory = (category) => {
  const json = category.toJSON ? category.toJSON() : category;
  const categorySkills = Array.isArray(json.categorySkills) ? json.categorySkills : [];

  return {
    id: json.id,
    name: json.name,
    hindi: json.hindi,
    icon: json.icon,
    color: json.color,
    isActive: json.isActive,
    skills: categorySkills
      .map((item) => item.skill)
      .filter(Boolean)
      .map((skill) => ({
        id: skill.id,
        skillName: skill.skillName,
        name: skill.skillName,
        hindi: skill.hindi,
        defaultWage: skill.defaultWage,
        category: skill.category,
        isActive: skill.isActive,
      })),
  };
};

const getCategoriesService = async ({ activeOnly } = {}) => {
  const where = activeOnly === "false" ? {} : { isActive: true };
  const data = await db.category.findAll({
    where,
    include: categoryInclude,
    order: [["id", "ASC"]],
  });

  return {
    statusCode: 200,
    body: { success: true, total: data.length, selectionRules: SELECTION_RULES, data: data.map(mapCategory) },
  };
};

const createCategoryService = async (payload) => {
  const name = normalizeText(payload.name);

  if (!name) {
    return { statusCode: 400, body: { success: false, message: "Category name is required" } };
  }

  const [data, created] = await db.category.findOrCreate({
    where: { name },
    defaults: {
      name,
      hindi: payload.hindi || null,
      icon: payload.icon || null,
      color: payload.color || null,
      isActive: true,
    },
  });

  if (!created) {
    await data.update({
      hindi: payload.hindi ?? data.hindi,
      icon: payload.icon ?? data.icon,
      color: payload.color ?? data.color,
      isActive: true,
    });
  }

  return {
    statusCode: created ? 201 : 200,
    body: { success: true, message: created ? "Category created" : "Category already existed, updated", data },
  };
};

const updateCategoryService = async (id, payload) => {
  const data = await db.category.findOne({ where: { id } });

  if (!data) {
    return { statusCode: 404, body: { success: false, message: "Category not found" } };
  }

  await data.update(payload);
  return { statusCode: 200, body: { success: true, message: "Category updated", data } };
};

const deleteCategoryService = async (id) => {
  const data = await db.category.findOne({ where: { id } });

  if (!data) {
    return { statusCode: 404, body: { success: false, message: "Category not found" } };
  }

  await data.update({ isActive: false });
  await db.categorySkill.update({ isActive: false }, { where: { categoryId: id } });
  return { statusCode: 200, body: { success: true, message: "Category disabled" } };
};

const getSkillsService = async ({ search, activeOnly } = {}) => {
  const where = activeOnly === "false" ? {} : { isActive: true };

  if (search) {
    where.skillName = { [Op.iLike]: `%${search}%` };
  }

  const data = await db.skill.findAll({ where, order: [["skillName", "ASC"]] });
  return { statusCode: 200, body: { success: true, total: data.length, data } };
};

const createSkillService = async (payload) => {
  const skillName = normalizeText(payload.skillName || payload.name);

  if (!skillName) {
    return { statusCode: 400, body: { success: false, message: "Skill name is required" } };
  }

  const [data, created] = await db.skill.findOrCreate({
    where: { skillName },
    defaults: {
      skillName,
      hindi: payload.hindi || null,
      defaultWage: Number(payload.defaultWage || 0),
      category: payload.category || "general",
      isActive: true,
    },
  });

  if (!created) {
    await data.update({
      hindi: payload.hindi ?? data.hindi,
      defaultWage: payload.defaultWage ?? data.defaultWage,
      category: payload.category ?? data.category,
      isActive: true,
    });
  }

  return {
    statusCode: created ? 201 : 200,
    body: { success: true, message: created ? "Skill created" : "Skill already existed, updated", data },
  };
};

const updateSkillService = async (id, payload) => {
  const data = await db.skill.findOne({ where: { id } });

  if (!data) {
    return { statusCode: 404, body: { success: false, message: "Skill not found" } };
  }

  await data.update(payload);
  return { statusCode: 200, body: { success: true, message: "Skill updated", data } };
};

const deleteSkillService = async (id) => {
  const data = await db.skill.findOne({ where: { id } });

  if (!data) {
    return { statusCode: 404, body: { success: false, message: "Skill not found" } };
  }

  await data.update({ isActive: false });
  await db.categorySkill.update({ isActive: false }, { where: { skillId: id } });
  return { statusCode: 200, body: { success: true, message: "Skill disabled" } };
};

const getCategorySkillsService = async (categoryId) => {
  const category = await db.category.findOne({
    where: { id: categoryId, isActive: true },
    include: categoryInclude,
  });

  if (!category) {
    return { statusCode: 404, body: { success: false, message: "Category not found" } };
  }

  const data = mapCategory(category);
  return { statusCode: 200, body: { success: true, total: data.skills.length, selectionRules: SELECTION_RULES, data } };
};

const addSkillToCategoryService = async (categoryId, payload) => {
  const category = await db.category.findOne({ where: { id: categoryId, isActive: true } });

  if (!category) {
    return { statusCode: 404, body: { success: false, message: "Category not found" } };
  }

  let skill = null;

  if (payload.skillId) {
    skill = await db.skill.findOne({ where: { id: payload.skillId } });
  } else {
    const skillResult = await createSkillService({ ...payload, category: payload.category || category.name });
    skill = skillResult.body.data;
  }

  if (!skill) {
    return { statusCode: 404, body: { success: false, message: "Skill not found" } };
  }

  const [mapping] = await db.categorySkill.findOrCreate({
    where: { categoryId: category.id, skillId: skill.id },
    defaults: { categoryId: category.id, skillId: skill.id, isActive: true },
  });

  if (!mapping.isActive) {
    await mapping.update({ isActive: true });
  }

  return {
    statusCode: 201,
    body: { success: true, message: "Skill added in category", data: { category, skill, mapping } },
  };
};

const removeSkillFromCategoryService = async (categoryId, skillId) => {
  const mapping = await db.categorySkill.findOne({ where: { categoryId, skillId } });

  if (!mapping) {
    return { statusCode: 404, body: { success: false, message: "Category skill mapping not found" } };
  }

  await mapping.update({ isActive: false });
  return { statusCode: 200, body: { success: true, message: "Skill removed from category" } };
};

module.exports = {
  getCategoriesService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
  getSkillsService,
  createSkillService,
  updateSkillService,
  deleteSkillService,
  getCategorySkillsService,
  addSkillToCategoryService,
  removeSkillFromCategoryService,
};
