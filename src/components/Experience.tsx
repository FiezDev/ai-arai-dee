import { motion } from 'framer-motion';

export default function Experience() {
  return (
    <main className="min-h-screen">
      <section data-section="hero" className="flex min-h-[100dvh] items-center justify-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="text-center text-5xl font-bold tracking-tight md:text-7xl"
        >
          ใช้ AI ทำอะไรดี
        </motion.h1>
      </section>
    </main>
  );
}
