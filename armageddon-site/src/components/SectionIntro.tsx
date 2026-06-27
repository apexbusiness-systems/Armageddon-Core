'use client';

import { motion } from 'framer-motion';

type SectionIntroProps = Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    descriptionClassName?: string;
    titleClassName?: string;
}>;

export default function SectionIntro({
    eyebrow,
    title,
    description,
    descriptionClassName = 'mono-data text-signal/60 max-w-3xl mx-auto leading-relaxed',
    titleClassName = 'display-large text-signal mb-8',
}: SectionIntroProps) {
    return (
        <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
        >
            <span className="mono-small text-[var(--aerospace)] tracking-[0.4em] block mb-4 uppercase">
                {eyebrow}
            </span>
            <h2 className={`${titleClassName} uppercase`}>{title}</h2>
            <p className={descriptionClassName}>{description}</p>
        </motion.div>
    );
}
