export async function nextNumericId(Model) {
  const latest = await Model.findOne({}).sort({ id: -1 }).select({ id: 1 }).lean();
  return Number(latest?.id || 0) + 1;
}
