%define _rootdir /opt/cloudwatch2graphite

Name:          cloudwatch2graphite
Version:       1
Release:       1
Summary:       Cloudwatch to Graphite
Packager:      Gene Wood <gene@mozilla.com>
Group:         Development/Libraries
License:       MPL 2.0
URL:           https://github.com/6a68/cloudwatch2graphite/
Source0:       %{name}.tar.gz
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root
AutoReqProv:   no
Requires:      nodejs >= 0.8.17
BuildRequires: npm, nodejs >= 0.8.17

%description
Tool to fetch Cloudwatch data and inject it into Graphite

%prep
%setup -q -c -n browserid

%build
npm install

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_rootdir}
for f in conf lib node_modules cw2graphite.js; do
    cp -rp $f %{buildroot}%{_rootdir}/
done

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%{_rootdir}

%changelog
* Tue May 21 2013 Gene Wood <gene@mozilla.com>
- Initial version
