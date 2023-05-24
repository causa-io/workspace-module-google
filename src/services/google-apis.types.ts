// This file is used to return nice TypeScript types when creating clients to Google APIs using the `GoogleApisService`.
// Unfortunately the TypeScript type utilities do not handle function overloading completely, which is why this file
// defines types for up to 12 overloads manually.

import { GoogleApis } from 'googleapis';

/**
 * Returns the `O` type parameter if it is a valid options object for an API client of version `V`.
 */
type ValidOptions<O, V> = O extends { version: V } ? O : never;

/**
 * Returns the `R` type parameter if `O` is a valid options object for an API client of version `V`.
 */
type ValidReturn<O, V, R> = O extends { version: V } ? R : never;

/**
 * Returns the options object to initialize the API client `GoogleApis[T]` with version `V`.
 */
export type OptionsOfApiClient<T extends keyof GoogleApis, V extends string> =
  | ArgsOf1<T, V>
  | ArgsOf2<T, V>
  | ArgsOf3<T, V>
  | ArgsOf4<T, V>
  | ArgsOf5<T, V>
  | ArgsOf6<T, V>
  | ArgsOf7<T, V>
  | ArgsOf8<T, V>
  | ArgsOf9<T, V>
  | ArgsOf10<T, V>
  | ArgsOf11<T, V>
  | ArgsOf12<T, V>;

/**
 * Returns the type of the API client `GoogleApis[T]` with version `V`.
 */
export type ApiClient<T extends keyof GoogleApis, V extends string> =
  | ReturnOf1<T, V>
  | ReturnOf2<T, V>
  | ReturnOf3<T, V>
  | ReturnOf4<T, V>
  | ReturnOf5<T, V>
  | ReturnOf6<T, V>
  | ReturnOf7<T, V>
  | ReturnOf8<T, V>
  | ReturnOf9<T, V>
  | ReturnOf10<T, V>
  | ReturnOf11<T, V>
  | ReturnOf12<T, V>;

type ArgsOf1<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
}
  ? ValidOptions<O1, V>
  : never;

type ArgsOf2<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
}
  ? ValidOptions<O1, V> | ValidOptions<O2, V>
  : never;

type ArgsOf3<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
}
  ? ValidOptions<O1, V> | ValidOptions<O2, V> | ValidOptions<O3, V>
  : never;

type ArgsOf4<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
  : never;

type ArgsOf5<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
  : never;

type ArgsOf6<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
  : never;

type ArgsOf7<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
  : never;

type ArgsOf8<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
  (options: infer O8): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
      | ValidOptions<O8, V>
  : never;

type ArgsOf9<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
  (options: infer O8): any;
  (options: infer O9): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
      | ValidOptions<O8, V>
      | ValidOptions<O9, V>
  : never;

type ArgsOf10<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
  (options: infer O8): any;
  (options: infer O9): any;
  (options: infer O10): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
      | ValidOptions<O8, V>
      | ValidOptions<O9, V>
      | ValidOptions<O10, V>
  : never;

type ArgsOf11<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
  (options: infer O8): any;
  (options: infer O9): any;
  (options: infer O10): any;
  (options: infer O11): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
      | ValidOptions<O8, V>
      | ValidOptions<O9, V>
      | ValidOptions<O10, V>
      | ValidOptions<O11, V>
  : never;

type ArgsOf12<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): any;
  (options: infer O2): any;
  (options: infer O3): any;
  (options: infer O4): any;
  (options: infer O5): any;
  (options: infer O6): any;
  (options: infer O7): any;
  (options: infer O8): any;
  (options: infer O9): any;
  (options: infer O10): any;
  (options: infer O11): any;
  (options: infer O12): any;
}
  ?
      | ValidOptions<O1, V>
      | ValidOptions<O2, V>
      | ValidOptions<O3, V>
      | ValidOptions<O4, V>
      | ValidOptions<O5, V>
      | ValidOptions<O6, V>
      | ValidOptions<O7, V>
      | ValidOptions<O8, V>
      | ValidOptions<O9, V>
      | ValidOptions<O10, V>
      | ValidOptions<O11, V>
      | ValidOptions<O12, V>
  : never;

type ReturnOf1<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
}
  ? ValidReturn<O1, V, R1>
  : never;

type ReturnOf2<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
}
  ? ValidReturn<O1, V, R1> | ValidReturn<O2, V, R2>
  : never;

type ReturnOf3<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
}
  ? ValidReturn<O1, V, R1> | ValidReturn<O2, V, R2> | ValidReturn<O3, V, R3>
  : never;

type ReturnOf4<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
  : never;

type ReturnOf5<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
  : never;

type ReturnOf6<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
  : never;

type ReturnOf7<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
  : never;

type ReturnOf8<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
  (options: infer O8): infer R8;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
      | ValidReturn<O8, V, R8>
  : never;

type ReturnOf9<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
  (options: infer O8): infer R8;
  (options: infer O9): infer R9;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
      | ValidReturn<O8, V, R8>
      | ValidReturn<O9, V, R9>
  : never;

type ReturnOf10<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
  (options: infer O8): infer R8;
  (options: infer O9): infer R9;
  (options: infer O10): infer R10;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
      | ValidReturn<O8, V, R8>
      | ValidReturn<O9, V, R9>
      | ValidReturn<O10, V, R10>
  : never;

type ReturnOf11<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
  (options: infer O8): infer R8;
  (options: infer O9): infer R9;
  (options: infer O10): infer R10;
  (options: infer O11): infer R11;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
      | ValidReturn<O8, V, R8>
      | ValidReturn<O9, V, R9>
      | ValidReturn<O10, V, R10>
      | ValidReturn<O11, V, R11>
  : never;

type ReturnOf12<
  T extends keyof GoogleApis,
  V extends string,
> = GoogleApis[T] extends {
  (options: infer O1): infer R1;
  (options: infer O2): infer R2;
  (options: infer O3): infer R3;
  (options: infer O4): infer R4;
  (options: infer O5): infer R5;
  (options: infer O6): infer R6;
  (options: infer O7): infer R7;
  (options: infer O8): infer R8;
  (options: infer O9): infer R9;
  (options: infer O10): infer R10;
  (options: infer O11): infer R11;
  (options: infer O12): infer R12;
}
  ?
      | ValidReturn<O1, V, R1>
      | ValidReturn<O2, V, R2>
      | ValidReturn<O3, V, R3>
      | ValidReturn<O4, V, R4>
      | ValidReturn<O5, V, R5>
      | ValidReturn<O6, V, R6>
      | ValidReturn<O7, V, R7>
      | ValidReturn<O8, V, R8>
      | ValidReturn<O9, V, R9>
      | ValidReturn<O10, V, R10>
      | ValidReturn<O11, V, R11>
      | ValidReturn<O12, V, R12>
  : never;
