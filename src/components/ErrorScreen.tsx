interface Props {
  title: string;
  titleFa: string;
  detail?: string;
}

export default function ErrorScreen({ title, titleFa, detail }: Props) {
  return (
    <div className="error-screen" role="alert">
      <p className="error-fa" lang="fa" dir="rtl">{titleFa}</p>
      <p className="error-en" lang="en" dir="ltr">{title}</p>
      {detail && <p className="error-detail" lang="en" dir="ltr">{detail}</p>}
      <button onClick={() => window.location.reload()} data-cursor="hover">تلاش دوباره · Retry</button>
    </div>
  );
}
