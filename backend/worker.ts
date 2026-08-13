export default {
  async fetch() {
    return Response.json({ ok: true, service: "clinic-template-backend" });
  },
};
