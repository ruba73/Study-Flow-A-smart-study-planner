type link={
    label:string;
    href:string;
}
type footerColProps={
    title:string;
    links:link[];
}
export default function FooterCol({ title,...rest}:footerColProps) {
    const {links}=rest;
    return (
        <div className="text-sm">
            <div className="mb-3 font-semibold">{title}</div>
            <ul className="space-y-2 text-black/60">
                {
                    links.map((link,index)=>(
                        <li key={index}>
                            <a
                                href={link.href}
                                className="group inline-flex items-center transition-colors duration-200 hover:text-[#2b135a]"
                            >
                                <span className="relative">
                                    {link.label}
                                    <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
                                </span>
                            </a>
                        </li>
                    ))
                }
            </ul>
        </div>
    );
}
