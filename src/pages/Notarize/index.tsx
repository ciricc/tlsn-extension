import classNames from 'classnames';
import React, {
  ReactElement,
  useState,
  useCallback,
  ReactEventHandler,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import { notarizeRequest, useRequest } from '../../reducers/requests';
import Icon from '../../components/Icon';
import { urlify } from '../../utils/misc';
import {
  getNotaryApi,
  getProxyApi,
  getMaxSent,
  getMaxRecv,
} from '../../utils/storage';
import { useDispatch } from 'react-redux';

export default function Notarize(): ReactElement {
  const params = useParams<{ requestId: string }>();
  const req = useRequest(params.requestId);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [step, setStep] = useState(0);
  const [secretHeaders, setSecretHeaders] = useState<string[]>([]);
  const [secretResps, setSecretResps] = useState<string[]>([]);

  const notarize = useCallback(async () => {
    if (!req) return;
    const hostname = urlify(req.url)?.hostname;
    const notaryUrl = await getNotaryApi();
    const websocketProxyUrl = await getProxyApi();
    const maxSentData = await getMaxSent();
    const maxRecvData = await getMaxRecv();
    const headers: { [k: string]: string } = req.requestHeaders.reduce(
      (acc: any, h) => {
        acc[h.name] = h.value;
        return acc;
      },
      { Host: hostname },
    );

    //TODO: for some reason, these needs to be override to work
    headers['Accept-Encoding'] = 'identity';
    headers['Connection'] = 'close';

    dispatch(
      // @ts-ignore
      notarizeRequest({
        url: req.url,
        method: req.method,
        headers,
        body: req.requestBody,
        maxSentData,
        maxRecvData,
        notaryUrl,
        websocketProxyUrl,
        secretHeaders,
        secretResps,
      }),
    );
    navigate(`/history`);
  }, [req, secretHeaders, secretResps]);

  if (!req) return <></>;

  let body;

  switch (step) {
    case 0:
      body = (
        <RevealHeaderStep
          onNext={() => setStep(1)}
          onCancel={() => navigate(-1)}
          setSecretHeaders={setSecretHeaders}
        />
      );
      break;
    case 1:
      body = (
        <HideResponseStep
          onNext={notarize}
          onCancel={() => setStep(0)}
          setSecretResps={setSecretResps}
        />
      );
      break;
    default:
      body = null;
      break;
  }

  return (
    <div className="flex flex-col flex-nowrap flex-grow">
      <div className="flex flex-row flex-nowrap relative items-center bg-slate-300 py-2 px-2 gap-2">
        <Icon
          className="cursor-point text-slate-400 hover:text-slate-700"
          fa="fa-solid fa-xmark"
          onClick={() => navigate(-1)}
        />
        <div className="flex flex-col flex-shrink flex-grow mr-20 w-0 select-none">
          <span className="font-bold text-slate-700">
            {`Notarizing a ${req.method} request`}
          </span>
          <span
            className="text-ellipsis whitespace-nowrap overflow-hidden"
            title={req.url}
          >
            {req.url}
          </span>
        </div>
      </div>
      {body}
    </div>
  );
}

export function RevealHeaderStep(props: {
  onNext: () => void;
  onCancel: () => void;
  setSecretHeaders: (secrets: string[]) => void;
}): ReactElement {
  const params = useParams<{ requestId: string }>();
  const req = useRequest(params.requestId);
  const [revealed, setRevealed] = useState<{ [key: string]: boolean }>({});

  const headers = req?.requestHeaders;

  useEffect(() => {
    if (!req) return;

    props.setSecretHeaders(
      req.requestHeaders
        .map((h) => {
          if (!revealed[h.name]) {
            return `${h.name.toLowerCase()}: ${h.value || ''}` || '';
          }
          return '';
        })
        .filter((d) => !!d),
    );
  }, [revealed]);

  const changeHeaderKey = useCallback(
    (key: string, shouldReveal: boolean) => {
      if (!req) return;

      setRevealed({
        ...revealed,
        [key]: shouldReveal,
      });
    },
    [revealed, req],
  );

  if (!headers) return <></>;

  return (
    <div className="flex flex-col flex-nowrap flex-shrink flex-grow h-0">
      <div className="border bg-primary/[0.9] text-white border-slate-300 py-1 px-2 font-semibold">
        `Step 1 of 2: Select which request headers you want to reveal`
      </div>
      <div className="flex-grow flex-shrink h-0 overflow-y-auto">
        <table className="border border-slate-300 border-collapse table-fixed">
          <tbody className="bg-slate-200">
            {headers.map((h) => (
              <tr
                key={h.name}
                className={classNames('border-b border-slate-200 text-xs', {
                  'bg-slate-50': revealed[h.name],
                })}
              >
                <td className="border border-slate-300 py-1 px-2 align-top">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    onChange={(e) => changeHeaderKey(h.name, e.target.checked)}
                    checked={revealed[h.name]}
                  />
                </td>
                <td className="border border-slate-300 font-bold align-top py-1 px-2 whitespace-nowrap">
                  {h.name}
                </td>
                <td className="border border-slate-300 break-all align-top py-1 px-2">
                  {revealed[h.name]
                    ? h.value
                    : Array(h.value?.length || 0)
                        .fill('*')
                        .join('')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-row justify-end p-2 gap-2 border-t">
        <button className="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          className="bg-primary/[0.9] text-white font-bold hover:bg-primary/[0.8] px-2 py-0.5 active:bg-primary"
          onClick={props.onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function RevealHeaderTable(props: {
  headers: { name: string; value: string }[];
  className?: string;
  onChange: (revealed: { [key: string]: boolean }) => void;
}) {
  const { headers } = props;
  const [revealed, setRevealed] = useState<{ [key: string]: boolean }>({});

  const changeHeaderKey = useCallback(
    (key: string, shouldReveal: boolean) => {
      const result = {
        ...revealed,
        [key]: shouldReveal,
      };
      setRevealed(result);
      props.onChange(result);
    },
    [revealed],
  );

  return (
    <table
      className={classNames(
        'border border-slate-300 border-collapse table-fixed',
        props.className,
      )}
    >
      <thead className="bg-slate-200">
        <th className="border border-slate-300 py-1 px-2 align-middle w-8"></th>
        <th className="border border-slate-300 py-1 px-2 align-middle">Name</th>
        <th className="border border-slate-300 py-1 px-2 align-middle">
          Value
        </th>
      </thead>
      <tbody className="bg-slate-100">
        {headers.map((h) => (
          <tr
            key={h.name}
            className={classNames('border-b border-slate-200 text-xs', {
              'bg-slate-50': revealed[h.name],
            })}
          >
            <td className="border border-slate-300 py-1 px-2 align-top w-8">
              <input
                type="checkbox"
                className="cursor-pointer"
                onChange={(e) => changeHeaderKey(h.name, e.target.checked)}
                checked={revealed[h.name]}
              />
            </td>
            <td className="border border-slate-300 font-bold align-top py-1 px-2 whitespace-nowrap">
              {h.name}
            </td>
            <td className="border border-slate-300 break-all align-top py-1 px-2">
              {revealed[h.name]
                ? h.value
                : Array(h.value?.length || 0)
                    .fill('*')
                    .join('')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HideResponseStep(props: {
  onNext: () => void;
  onCancel: () => void;
  setSecretResps: (secrets: string[]) => void;
}): React.ReactElement {
  const params = useParams<{ requestId: string }>();
  const req = useRequest(params.requestId);
  const [responseText, setResponseText] = useState('');
  const [redactedRanges, setRedactedRanges] = useState<
    { start: number; end: number }[]
  >([]);
  const [isRedactMode, setIsRedactMode] = useState(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const onSelectionChange: React.MouseEventHandler<HTMLTextAreaElement> =
    useCallback(
      (e) => {
        const ta = e.currentTarget;
        if (isRedactMode && ta.selectionEnd > ta.selectionStart) {
          const newRange: { start: number; end: number } = {
            start: ta.selectionStart,
            end: ta.selectionEnd,
          };

          setRedactedRanges((prevRanges) => {
            let updatedRanges = [...prevRanges, newRange].sort(
              (a, b) => a.start - b.start,
            );
            updatedRanges = mergeRanges(updatedRanges);

            const secretResps = updatedRanges
              .map(({ start, end }) => responseText.substring(start, end))
              .filter((d) => !!d);
            props.setSecretResps(secretResps);

            return updatedRanges;
          });
        } else if (!isRedactMode) {
          const clickPosition = ta.selectionStart;
          setRedactedRanges((prevRanges) => {
            const updatedRanges = prevRanges.filter(
              ({ start, end }) => clickPosition < start || clickPosition > end,
            );

            const secretResps = updatedRanges
              .map(({ start, end }) => responseText.substring(start, end))
              .filter((d) => !!d);
            props.setSecretResps(secretResps);

            return updatedRanges;
          });
        }
      },
      [responseText, props, isRedactMode],
    );

  const mergeRanges = (
    ranges: { start: number; end: number }[],
  ): { start: number; end: number }[] => {
    if (ranges.length === 0) return [];
    const mergedRanges: { start: number; end: number }[] = [ranges[0]];

    for (let i = 1; i < ranges.length; i++) {
      const lastRange = mergedRanges[mergedRanges.length - 1];
      if (ranges[i].start <= lastRange.end) {
        lastRange.end = Math.max(lastRange.end, ranges[i].end);
      } else {
        mergedRanges.push(ranges[i]);
      }
    }

    return mergedRanges;
  };

  useEffect(() => {
    if (!req) return;

    const options = {
      method: req.method,
      headers: req.requestHeaders.reduce(
        // @ts-ignore
        (acc: { [key: string]: string }, h: chrome.webRequest.HttpHeader) => {
          if (typeof h.name !== 'undefined' && typeof h.value !== 'undefined') {
            acc[h.name] = h.value;
          }
          return acc;
        },
        {},
      ),
      body: req.requestBody,
    };

    if (req?.formData) {
      const formData = new URLSearchParams();
      Object.entries(req.formData).forEach(([key, values]) => {
        values.forEach((v) => formData.append(key, v));
      });
      options.body = formData.toString();
    }

    replay(req.url, options).then((resp) => setResponseText(resp));
  }, [req]);

  useEffect(() => {
    const current = taRef.current;

    if (current) {
      current.focus();
    }
  }, [taRef]);

  if (!req) return <></>;

  const shieldedText = responseText.split('');
  redactedRanges.forEach(({ start, end }) => {
    for (let i = start; i < end; i++) {
      shieldedText[i] = '*';
    }
  });

  return (
    <div className="flex flex-col flex-nowrap flex-shrink flex-grow h-0">
      <div className="border bg-primary/[0.9] text-white border-slate-300 py-1 px-2 font-semibold">
        Step 2 of 2:{' '}
        {isRedactMode
          ? 'Highlight text to redact selected portions'
          : 'Click redacted text to unredact'}
      </div>
      <div className="flex flex-row justify-end p-0.5 gap-2 border-t">
        <button
          className={`bg-${isRedactMode ? 'red-500' : 'green-500'} text-white font-bold hover:bg-${isRedactMode ? 'red-400' : 'green-400'} px-2 py-0.5 active:bg-${isRedactMode ? 'red-600' : 'green-600'}`}
          onClick={() => setIsRedactMode(!isRedactMode)}
        >
          {isRedactMode ? 'Unredact Text' : 'Redact Text'}
        </button>
        <button
          className="bg-gray-500 text-white font-bold hover:bg-gray-400 px-2 py-0.5 active:bg-gray-600"
          onClick={() => setRedactedRanges([])}
        >
          Unredact All
        </button>
      </div>
      <div className="flex flex-col flex-grow flex-shrink h-0 overflow-y-auto p-2">
        <textarea
          ref={taRef}
          className="flex-grow textarea bg-slate-100 font-mono"
          value={shieldedText.join('')}
          onMouseUp={onSelectionChange}
        />
      </div>
      <div className="flex flex-row justify-end p-2 gap-2 border-t">
        <button className="button" onClick={props.onCancel}>
          Back
        </button>
        <button
          className="bg-primary/[0.9] text-white font-bold hover:bg-primary/[0.8] px-2 py-0.5 active:bg-primary"
          onClick={props.onNext}
        >
          Notarize
        </button>
      </div>
    </div>
  );
}

export function RedactBodyTextarea(props: {
  className?: string;
  onChange: (secretResponse: string[]) => void;
  request: {
    url: string;
    method?: string;
    headers?: { [name: string]: string };
    formData?: { [k: string]: string[] };
    body?: string;
  };
}) {
  const { className, onChange, request } = props;

  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const onSelectionChange: ReactEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      const ta = e.currentTarget;
      if (ta.selectionEnd > ta.selectionStart) {
        setStart(ta.selectionStart);
        setEnd(ta.selectionEnd);
        onChange(
          [
            responseText.substring(0, ta.selectionStart),
            responseText.substring(ta.selectionEnd, responseText.length),
          ].filter((d) => !!d),
        );
      }
    },
    [responseText],
  );

  useEffect(() => {
    const options = {
      method: request.method,
      headers: request.headers,
      body: request.body,
    };

    if (request?.formData) {
      const formData = new URLSearchParams();
      Object.entries(request.formData).forEach(([key, values]) => {
        values.forEach((v) => formData.append(key, v));
      });
      options.body = formData.toString();
    }

    setLoading(true);
    replay(request.url, options).then((resp) => {
      setResponseText(resp);
      setLoading(false);
    });
  }, [request]);

  useEffect(() => {
    const current = taRef.current;

    if (current) {
      current.focus();
      current.setSelectionRange(start, end);
    }
  }, [taRef, start, end]);

  let shieldedText = '';

  if (end > start) {
    shieldedText = Array(start)
      .fill('*')
      .join('')
      .concat(responseText.substring(start, end))
      .concat(
        Array(responseText.length - end)
          .fill('*')
          .join(''),
      );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center !pt-4 flex-grow textarea bg-slate-100">
        <Icon
          className="animate-spin w-fit text-slate-500"
          fa="fa-solid fa-spinner"
          size={1}
        />
      </div>
    );
  }

  return (
    <textarea
      ref={taRef}
      className={classNames(
        'flex-grow textarea bg-slate-100 font-mono',
        className,
      )}
      value={shieldedText || responseText}
      onSelect={onSelectionChange}
    />
  );
}

const replay = async (url: string, options: any) => {
  const resp = await fetch(url, options);
  const contentType =
    resp?.headers.get('content-type') || resp?.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    return resp.text();
  } else if (contentType?.includes('text')) {
    return resp.text();
  } else if (contentType?.includes('image')) {
    return resp.blob().then((blob) => blob.text());
  } else {
    return resp.blob().then((blob) => blob.text());
  }
};
