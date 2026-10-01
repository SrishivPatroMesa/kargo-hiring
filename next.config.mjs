/** @type {import('next').NextConfig} */
const nextConfig = {
  // rubric.txt is read at runtime to seed the rubric_criteria table if it is empty
  outputFileTracingIncludes: { "/**": ["./rubric.txt"] },
  serverExternalPackages: ["unpdf", "mammoth"],
};
export default nextConfig;
